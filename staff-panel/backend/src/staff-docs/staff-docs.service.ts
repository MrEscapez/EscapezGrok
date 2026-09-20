import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname, isAbsolute, join } from 'path';
import type {
  StaffDocArticle,
  StaffDocCategory,
  StaffDocsFileShape,
} from './staff-docs.types';

@Injectable()
export class StaffDocsService implements OnModuleInit {
  private readonly logger = new Logger(StaffDocsService.name);
  private categories = new Map<string, StaffDocCategory>();
  private articles = new Map<string, StaffDocArticle>();
  private dataPath = '';
  private ready = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.dataPath = this.resolveDataPath();
    await this.loadOrSeed();
    this.ready = true;
  }

  private resolveDataPath(): string {
    const configured = this.config.get<string>('STAFF_DOCS_DATA_PATH');
    if (configured && configured.trim()) {
      return isAbsolute(configured)
        ? configured
        : join(process.cwd(), configured);
    }
    return join(process.cwd(), 'data', 'staff-docs.json');
  }

  isReady(): boolean {
    return this.ready;
  }

  listCategories(): StaffDocCategory[] {
    return [...this.categories.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  }

  listArticles(categoryId?: string): StaffDocArticle[] {
    let items = [...this.articles.values()];
    if (categoryId) {
      items = items.filter((a) => a.categoryId === categoryId);
    }
    return items.sort((a, b) => a.title.localeCompare(b.title));
  }

  getArticle(id: string): StaffDocArticle {
    const a = this.articles.get(id);
    if (!a) throw new NotFoundException('Artikel niet gevonden');
    return { ...a };
  }

  getCategory(id: string): StaffDocCategory {
    const c = this.categories.get(id);
    if (!c) throw new NotFoundException('Categorie niet gevonden');
    return { ...c };
  }

  async createCategory(
    input: { name: string; sortOrder?: number },
    by: string,
  ): Promise<StaffDocCategory> {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('Naam is verplicht');
    const now = new Date().toISOString();
    const cat: StaffDocCategory = {
      id: `cat_${randomUUID()}`,
      name,
      sortOrder:
        typeof input.sortOrder === 'number'
          ? input.sortOrder
          : this.nextSortOrder(),
      createdBy: by,
      createdAt: now,
      updatedBy: by,
      updatedAt: now,
    };
    this.categories.set(cat.id, cat);
    await this.persist();
    return { ...cat };
  }

  async updateCategory(
    id: string,
    input: { name?: string; sortOrder?: number },
    by: string,
  ): Promise<StaffDocCategory> {
    const cat = this.categories.get(id);
    if (!cat) throw new NotFoundException('Categorie niet gevonden');
    if (typeof input.name === 'string') {
      const name = input.name.trim();
      if (!name) throw new BadRequestException('Naam is verplicht');
      cat.name = name;
    }
    if (typeof input.sortOrder === 'number') {
      cat.sortOrder = input.sortOrder;
    }
    cat.updatedBy = by;
    cat.updatedAt = new Date().toISOString();
    this.categories.set(id, cat);
    await this.persist();
    return { ...cat };
  }

  async deleteCategory(id: string): Promise<{ ok: true }> {
    if (!this.categories.has(id)) {
      throw new NotFoundException('Categorie niet gevonden');
    }
    const linked = [...this.articles.values()].filter(
      (a) => a.categoryId === id,
    );
    if (linked.length > 0) {
      throw new BadRequestException(
        `Categorie heeft nog ${linked.length} artikel(en). Verwijder of verplaats die eerst.`,
      );
    }
    this.categories.delete(id);
    await this.persist();
    return { ok: true };
  }

  async createArticle(
    input: { categoryId: string; title: string; body: string },
    by: string,
  ): Promise<StaffDocArticle> {
    if (!this.categories.has(input.categoryId)) {
      throw new BadRequestException('Onbekende categorie');
    }
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title || !body) {
      throw new BadRequestException('Titel en inhoud zijn verplicht');
    }
    const now = new Date().toISOString();
    const article: StaffDocArticle = {
      id: `art_${randomUUID()}`,
      categoryId: input.categoryId,
      title,
      body,
      createdBy: by,
      createdAt: now,
      updatedBy: by,
      updatedAt: now,
    };
    this.articles.set(article.id, article);
    await this.persist();
    return { ...article };
  }

  async updateArticle(
    id: string,
    input: { categoryId?: string; title?: string; body?: string },
    by: string,
  ): Promise<StaffDocArticle> {
    const article = this.articles.get(id);
    if (!article) throw new NotFoundException('Artikel niet gevonden');
    if (typeof input.categoryId === 'string') {
      if (!this.categories.has(input.categoryId)) {
        throw new BadRequestException('Onbekende categorie');
      }
      article.categoryId = input.categoryId;
    }
    if (typeof input.title === 'string') {
      const title = input.title.trim();
      if (!title) throw new BadRequestException('Titel is verplicht');
      article.title = title;
    }
    if (typeof input.body === 'string') {
      const body = input.body.trim();
      if (!body) throw new BadRequestException('Inhoud is verplicht');
      article.body = body;
    }
    article.updatedBy = by;
    article.updatedAt = new Date().toISOString();
    this.articles.set(id, article);
    await this.persist();
    return { ...article };
  }

  async deleteArticle(id: string): Promise<{ ok: true }> {
    if (!this.articles.has(id)) {
      throw new NotFoundException('Artikel niet gevonden');
    }
    this.articles.delete(id);
    await this.persist();
    return { ok: true };
  }

  private nextSortOrder(): number {
    let max = -1;
    for (const c of this.categories.values()) {
      if (c.sortOrder > max) max = c.sortOrder;
    }
    return max + 1;
  }

  private async loadOrSeed(): Promise<void> {
    try {
      const raw = await readFile(this.dataPath, 'utf8');
      const parsed = JSON.parse(raw) as StaffDocsFileShape;
      if (parsed?.version === 1 && Array.isArray(parsed.categories)) {
        this.applyFile(parsed);
        this.logger.log(`Staff-docs geladen uit ${this.dataPath}`);
        return;
      }
    } catch {
      // missing or invalid → seed
    }
    this.seedSamples();
    await this.persist();
    this.logger.log(`Staff-docs geseeded naar ${this.dataPath}`);
  }

  private applyFile(file: StaffDocsFileShape): void {
    this.categories.clear();
    this.articles.clear();
    for (const c of file.categories ?? []) {
      if (!c?.id || !c?.name) continue;
      this.categories.set(c.id, { ...c });
    }
    for (const a of file.articles ?? []) {
      if (!a?.id || !a?.title || !a?.categoryId) continue;
      this.articles.set(a.id, { ...a });
    }
  }

  private seedSamples(): void {
    const now = new Date().toISOString();
    const by = 'systeem';
    const catBasics: StaffDocCategory = {
      id: 'cat_panel_basics',
      name: 'Panel basics',
      sortOrder: 0,
      createdBy: by,
      createdAt: now,
      updatedBy: by,
      updatedAt: now,
    };
    const catServers: StaffDocCategory = {
      id: 'cat_servers',
      name: 'Servers & power',
      sortOrder: 1,
      createdBy: by,
      createdAt: now,
      updatedBy: by,
      updatedAt: now,
    };
    this.categories.set(catBasics.id, catBasics);
    this.categories.set(catServers.id, catServers);

    const art1: StaffDocArticle = {
      id: 'art_welcome',
      categoryId: catBasics.id,
      title: 'Welkom bij het Staff Panel',
      body: [
        '# Welkom',
        '',
        'Dit Staff Panel is de centrale plek voor EscapezCraft-staff.',
        'Je hebt **geen** aparte Pterodactyl staff-login nodig voor dagelijkse taken.',
        '',
        '## Rollen',
        '- **Helper** — bekijken van spelers, reports, tickets en Staff Info.',
        '- **Moderator** — beheer + Staff Info schrijven + console/RCON (geen power).',
        '- **Admin** — alles, inclusief Instellingen en server power.',
        '',
        '## Veiligheid',
        '- API-keys en RCON-wachtwoorden staan alleen op de backend.',
        '- Demo-logins gebruiken placeholders (CHANGE_ME) — wijzig die in productie.',
        '',
        'Vragen? Vraag een admin of kijk verder in deze kennisbank.',
      ].join('\n'),
      createdBy: by,
      createdAt: now,
      updatedBy: by,
      updatedAt: now,
    };

    const art2: StaffDocArticle = {
      id: 'art_servers',
      categoryId: catServers.id,
      title: 'Servers beheren zonder Ptero-login',
      body: [
        '# Multi-server vanuit het panel',
        '',
        'Op de **Server**-pagina zie je alle servers uit de Pterodactyl Application API.',
        '',
        '## Vereisten (admin)',
        '1. Ga naar **Instellingen → Pterodactyl**.',
        '2. Vul panel-URL + Application API-key in (optioneel: Client API-key voor live power).',
        '3. Test de verbinding — secrets worden gemaskeerd teruggegeven.',
        '',
        '## Acties',
        '- **Power** (start/stop/restart) vereist `server:power`.',
        '- **RCON** vereist `server:command` (veilige allowlist zonder extra confirm).',
        '',
        'Gebruik de serverlijst/switcher om de juiste server te kiezen. Staff logt niet in op Ptero zelf.',
      ].join('\n'),
      createdBy: by,
      createdAt: now,
      updatedBy: by,
      updatedAt: now,
    };

    this.articles.set(art1.id, art1);
    this.articles.set(art2.id, art2);
  }

  private async persist(): Promise<void> {
    const payload: StaffDocsFileShape = {
      version: 1,
      categories: this.listCategories(),
      articles: [...this.articles.values()].sort((a, b) =>
        a.title.localeCompare(b.title),
      ),
    };
    await mkdir(dirname(this.dataPath), { recursive: true });
    const tmp = `${this.dataPath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
    await rename(tmp, this.dataPath);
  }
}

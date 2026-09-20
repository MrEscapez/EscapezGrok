import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HelpTip } from '../components/HelpTip';
import { useCan } from '../hooks/useMeQuery';
import {
  ApiError,
  createStaffDocArticle,
  createStaffDocCategory,
  deleteStaffDocArticle,
  deleteStaffDocCategory,
  fetchStaffDocArticles,
  fetchStaffDocCategories,
  updateStaffDocArticle,
  updateStaffDocCategory,
  type StaffDocArticle,
} from '../lib/api';

function formatNlDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nl-BE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

/** Minimal markdown-ish render: headings + paragraphs, no HTML injection. */
function renderBody(body: string): ReactNode[] {
  const lines = body.split('\n');
  const nodes: ReactNode[] = [];
  let para: string[] = [];
  const flush = (key: string) => {
    if (para.length === 0) return;
    nodes.push(
      <p key={key} className="staff-docs-prose__p">
        {para.join(' ')}
      </p>,
    );
    para = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush(`p-${i}`);
      return;
    }
    if (line.startsWith('# ')) {
      flush(`p-before-h1-${i}`);
      nodes.push(
        <h2 key={`h1-${i}`} className="staff-docs-prose__h1">
          {line.slice(2)}
        </h2>,
      );
      return;
    }
    if (line.startsWith('## ')) {
      flush(`p-before-h2-${i}`);
      nodes.push(
        <h3 key={`h2-${i}`} className="staff-docs-prose__h2">
          {line.slice(3)}
        </h3>,
      );
      return;
    }
    if (line.startsWith('- ')) {
      flush(`p-before-li-${i}`);
      nodes.push(
        <li key={`li-${i}`} className="staff-docs-prose__li">
          {line.slice(2).replace(/\*\*(.+?)\*\*/g, '$1')}
        </li>,
      );
      return;
    }
    para.push(line.replace(/\*\*(.+?)\*\*/g, '$1'));
  });
  flush('p-end');
  return nodes;
}

type EditorState =
  | null
  | { mode: 'create-article'; categoryId: string }
  | { mode: 'edit-article'; article: StaffDocArticle }
  | { mode: 'create-category' }
  | { mode: 'edit-category'; id: string; name: string };

export function StaffInfoPage() {
  const can = useCan();
  const canWrite = can('staff_docs:write');
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    null,
  );
  const [editor, setEditor] = useState<EditorState>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const catsQuery = useQuery({
    queryKey: ['staff-docs', 'categories'],
    queryFn: fetchStaffDocCategories,
  });

  const articlesQuery = useQuery({
    queryKey: ['staff-docs', 'articles', selectedCategoryId ?? 'all'],
    queryFn: () =>
      fetchStaffDocArticles(selectedCategoryId ?? undefined),
  });

  const categories = catsQuery.data?.items ?? [];
  const articles = articlesQuery.data?.items ?? [];

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (
      selectedArticleId &&
      articles.length > 0 &&
      !articles.some((a) => a.id === selectedArticleId)
    ) {
      setSelectedArticleId(null);
    }
  }, [articles, selectedArticleId]);

  const selectedArticle = useMemo(
    () => articles.find((a) => a.id === selectedArticleId) ?? null,
    [articles, selectedArticleId],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['staff-docs'] });
  };

  const saveArticleMutation = useMutation({
    mutationFn: async () => {
      if (!editor || editor.mode === 'create-category' || editor.mode === 'edit-category') {
        throw new Error('Geen artikel-editor');
      }
      if (editor.mode === 'create-article') {
        const title = (
          document.getElementById('docs-title') as HTMLInputElement
        )?.value?.trim();
        const body = (
          document.getElementById('docs-body') as HTMLTextAreaElement
        )?.value?.trim();
        if (!title || !body) throw new Error('Titel en inhoud zijn verplicht');
        return createStaffDocArticle({
          categoryId: editor.categoryId,
          title,
          body,
        });
      }
      const title = (
        document.getElementById('docs-title') as HTMLInputElement
      )?.value?.trim();
      const body = (
        document.getElementById('docs-body') as HTMLTextAreaElement
      )?.value?.trim();
      const categoryId = (
        document.getElementById('docs-cat') as HTMLSelectElement
      )?.value;
      return updateStaffDocArticle(editor.article.id, {
        title,
        body,
        categoryId,
      });
    },
    onSuccess: (art) => {
      setFeedback('Artikel opgeslagen.');
      setEditor(null);
      setSelectedArticleId(art.id);
      setSelectedCategoryId(art.categoryId);
      invalidate();
    },
    onError: (err) => {
      setFeedback(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Opslaan mislukt.',
      );
    },
  });

  const saveCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!editor || (editor.mode !== 'create-category' && editor.mode !== 'edit-category')) {
        throw new Error('Geen categorie-editor');
      }
      const name = (
        document.getElementById('docs-cat-name') as HTMLInputElement
      )?.value?.trim();
      if (!name) throw new Error('Naam is verplicht');
      if (editor.mode === 'create-category') {
        return createStaffDocCategory({ name });
      }
      return updateStaffDocCategory(editor.id, { name });
    },
    onSuccess: (cat) => {
      setFeedback('Categorie opgeslagen.');
      setEditor(null);
      setSelectedCategoryId(cat.id);
      invalidate();
    },
    onError: (err) => {
      setFeedback(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Opslaan mislukt.',
      );
    },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: (id: string) => deleteStaffDocArticle(id),
    onSuccess: () => {
      setFeedback('Artikel verwijderd.');
      setSelectedArticleId(null);
      setEditor(null);
      invalidate();
    },
    onError: (err) => {
      setFeedback(
        err instanceof ApiError ? err.message : 'Verwijderen mislukt.',
      );
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteStaffDocCategory(id),
    onSuccess: () => {
      setFeedback('Categorie verwijderd.');
      setSelectedCategoryId(null);
      setSelectedArticleId(null);
      invalidate();
    },
    onError: (err) => {
      setFeedback(
        err instanceof ApiError ? err.message : 'Verwijderen mislukt.',
      );
    },
  });

  function onEditorSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editor) return;
    if (editor.mode === 'create-category' || editor.mode === 'edit-category') {
      saveCategoryMutation.mutate();
    } else {
      saveArticleMutation.mutate();
    }
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title page__title-row">
          <span>Staff Info</span>
          <HelpTip label="Uitleg Staff Info" wide>
            <p>
              Interne kennisbank voor staff. Lezen vereist{' '}
              <code>staff_docs:read</code>; bewerken{' '}
              <code>staff_docs:write</code> (admin/moderator).
            </p>
            <p>Geen geheimen of API-keys in artikelen zetten.</p>
          </HelpTip>
        </h1>
        <p className="page__desc">
          Kennisbank met categorieën en artikelen — panel-basics, procedures en
          tips. Alleen voor ingelogde staff.
        </p>
      </header>

      {feedback && (
        <div className="server-feedback server-feedback--ok" role="status">
          {feedback}
          <button
            type="button"
            className="server-chip"
            style={{ marginLeft: '0.75rem' }}
            onClick={() => setFeedback(null)}
          >
            Sluiten
          </button>
        </div>
      )}

      <div className="staff-docs">
        <aside className="staff-docs__sidebar" aria-label="Categorieën">
          <div className="staff-docs__side-head">
            <h2 className="staff-docs__side-title">Categorieën</h2>
            {canWrite && (
              <button
                type="button"
                className="server-chip"
                onClick={() => setEditor({ mode: 'create-category' })}
              >
                + Nieuw
              </button>
            )}
          </div>
          {catsQuery.isPending ? (
            <p className="empty-state">Laden…</p>
          ) : categories.length === 0 ? (
            <p className="empty-state">Nog geen categorieën.</p>
          ) : (
            <ul className="staff-docs__cat-list">
              {categories.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={
                      selectedCategoryId === c.id
                        ? 'staff-docs__cat staff-docs__cat--active'
                        : 'staff-docs__cat'
                    }
                    onClick={() => {
                      setSelectedCategoryId(c.id);
                      setSelectedArticleId(null);
                      setEditor(null);
                    }}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {canWrite && selectedCategoryId && (
            <div className="staff-docs__side-actions">
              <button
                type="button"
                className="server-chip"
                onClick={() => {
                  const c = categories.find((x) => x.id === selectedCategoryId);
                  if (c) {
                    setEditor({
                      mode: 'edit-category',
                      id: c.id,
                      name: c.name,
                    });
                  }
                }}
              >
                Hernoemen
              </button>
              <button
                type="button"
                className="server-chip"
                onClick={() => {
                  if (
                    window.confirm(
                      'Categorie verwijderen? Alleen mogelijk zonder artikelen.',
                    )
                  ) {
                    deleteCategoryMutation.mutate(selectedCategoryId);
                  }
                }}
              >
                Verwijderen
              </button>
            </div>
          )}
        </aside>

        <div className="staff-docs__list" aria-label="Artikelen">
          <div className="staff-docs__side-head">
            <h2 className="staff-docs__side-title">Artikelen</h2>
            {canWrite && selectedCategoryId && (
              <button
                type="button"
                className="server-chip"
                onClick={() =>
                  setEditor({
                    mode: 'create-article',
                    categoryId: selectedCategoryId,
                  })
                }
              >
                + Artikel
              </button>
            )}
          </div>
          {articlesQuery.isPending ? (
            <p className="empty-state">Laden…</p>
          ) : articles.length === 0 ? (
            <p className="empty-state">Geen artikelen in deze categorie.</p>
          ) : (
            <ul className="staff-docs__art-list">
              {articles.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className={
                      selectedArticleId === a.id
                        ? 'staff-docs__art staff-docs__art--active'
                        : 'staff-docs__art'
                    }
                    onClick={() => {
                      setSelectedArticleId(a.id);
                      setEditor(null);
                    }}
                  >
                    <strong>{a.title}</strong>
                    <span className="staff-docs__meta">
                      {a.updatedBy} · {formatNlDate(a.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <article className="staff-docs__reader dash-card">
          {editor ? (
            <form className="staff-docs__editor" onSubmit={onEditorSubmit}>
              <h2 className="dash-card__title">
                {editor.mode === 'create-article' && 'Nieuw artikel'}
                {editor.mode === 'edit-article' && 'Artikel bewerken'}
                {editor.mode === 'create-category' && 'Nieuwe categorie'}
                {editor.mode === 'edit-category' && 'Categorie bewerken'}
              </h2>

              {(editor.mode === 'create-category' ||
                editor.mode === 'edit-category') && (
                <>
                  <label className="server-label" htmlFor="docs-cat-name">
                    Naam
                  </label>
                  <input
                    id="docs-cat-name"
                    className="server-input"
                    defaultValue={
                      editor.mode === 'edit-category' ? editor.name : ''
                    }
                    maxLength={120}
                    required
                  />
                </>
              )}

              {(editor.mode === 'create-article' ||
                editor.mode === 'edit-article') && (
                <>
                  {editor.mode === 'edit-article' && (
                    <>
                      <label className="server-label" htmlFor="docs-cat">
                        Categorie
                      </label>
                      <select
                        id="docs-cat"
                        className="server-input"
                        defaultValue={editor.article.categoryId}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <label className="server-label" htmlFor="docs-title">
                    Titel
                  </label>
                  <input
                    id="docs-title"
                    className="server-input"
                    defaultValue={
                      editor.mode === 'edit-article' ? editor.article.title : ''
                    }
                    maxLength={200}
                    required
                  />
                  <label className="server-label" htmlFor="docs-body">
                    Inhoud (markdown-achtig: # ## -)
                  </label>
                  <textarea
                    id="docs-body"
                    className="server-input staff-docs__textarea"
                    defaultValue={
                      editor.mode === 'edit-article' ? editor.article.body : ''
                    }
                    rows={16}
                    maxLength={50000}
                    required
                  />
                </>
              )}

              <div className="staff-docs__editor-actions">
                <button
                  type="button"
                  className="server-btn server-btn--ghost"
                  onClick={() => setEditor(null)}
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="server-btn server-btn--primary"
                  disabled={
                    saveArticleMutation.isPending ||
                    saveCategoryMutation.isPending
                  }
                >
                  Opslaan
                </button>
              </div>
            </form>
          ) : selectedArticle ? (
            <>
              <div className="dash-card__head">
                <h2 className="dash-card__title">{selectedArticle.title}</h2>
                {canWrite && (
                  <div className="server-table__actions">
                    <button
                      type="button"
                      className="server-chip"
                      onClick={() =>
                        setEditor({
                          mode: 'edit-article',
                          article: selectedArticle,
                        })
                      }
                    >
                      Bewerken
                    </button>
                    <button
                      type="button"
                      className="server-chip"
                      onClick={() => {
                        if (window.confirm('Artikel definitief verwijderen?')) {
                          deleteArticleMutation.mutate(selectedArticle.id);
                        }
                      }}
                    >
                      Verwijderen
                    </button>
                  </div>
                )}
              </div>
              <p className="staff-docs__byline">
                Auteur: <strong>{selectedArticle.createdBy}</strong> (
                {formatNlDate(selectedArticle.createdAt)})
                {selectedArticle.updatedAt !== selectedArticle.createdAt && (
                  <>
                    {' '}
                    · Bijgewerkt door{' '}
                    <strong>{selectedArticle.updatedBy}</strong> (
                    {formatNlDate(selectedArticle.updatedAt)})
                  </>
                )}
              </p>
              <div className="staff-docs-prose">
                {renderBody(selectedArticle.body)}
              </div>
            </>
          ) : (
            <p className="empty-state">
              Kies een artikel links, of maak er een aan als je schrijfrechten
              hebt.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Permissions } from '../rbac/permissions';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import type { StaffRequest } from '../rbac/staff-request';
import { CreateArticleDto } from './dto/create-article.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { StaffDocsService } from './staff-docs.service';

@Controller('staff-docs')
export class StaffDocsController {
  constructor(private readonly docs: StaffDocsService) {}

  private username(req: StaffRequest): string {
    return req.staffSession?.username ?? 'unknown';
  }

  @Get('categories')
  @RequirePermissions(Permissions.STAFF_DOCS_READ)
  listCategories() {
    return { items: this.docs.listCategories() };
  }

  @Get('categories/:id')
  @RequirePermissions(Permissions.STAFF_DOCS_READ)
  getCategory(@Param('id') id: string) {
    return this.docs.getCategory(id);
  }

  @Post('categories')
  @HttpCode(200)
  @RequirePermissions(Permissions.STAFF_DOCS_WRITE)
  createCategory(@Req() req: StaffRequest, @Body() body: CreateCategoryDto) {
    return this.docs.createCategory(body, this.username(req));
  }

  @Put('categories/:id')
  @RequirePermissions(Permissions.STAFF_DOCS_WRITE)
  updateCategory(
    @Req() req: StaffRequest,
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.docs.updateCategory(id, body, this.username(req));
  }

  @Delete('categories/:id')
  @RequirePermissions(Permissions.STAFF_DOCS_WRITE)
  deleteCategory(@Param('id') id: string) {
    return this.docs.deleteCategory(id);
  }

  @Get('articles')
  @RequirePermissions(Permissions.STAFF_DOCS_READ)
  listArticles(@Query('categoryId') categoryId?: string) {
    return { items: this.docs.listArticles(categoryId) };
  }

  @Get('articles/:id')
  @RequirePermissions(Permissions.STAFF_DOCS_READ)
  getArticle(@Param('id') id: string) {
    return this.docs.getArticle(id);
  }

  @Post('articles')
  @HttpCode(200)
  @RequirePermissions(Permissions.STAFF_DOCS_WRITE)
  createArticle(@Req() req: StaffRequest, @Body() body: CreateArticleDto) {
    return this.docs.createArticle(body, this.username(req));
  }

  @Put('articles/:id')
  @RequirePermissions(Permissions.STAFF_DOCS_WRITE)
  updateArticle(
    @Req() req: StaffRequest,
    @Param('id') id: string,
    @Body() body: UpdateArticleDto,
  ) {
    return this.docs.updateArticle(id, body, this.username(req));
  }

  @Delete('articles/:id')
  @RequirePermissions(Permissions.STAFF_DOCS_WRITE)
  deleteArticle(@Param('id') id: string) {
    return this.docs.deleteArticle(id);
  }
}

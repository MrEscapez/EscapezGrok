export type StaffDocCategory = {
  id: string;
  name: string;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
};

export type StaffDocArticle = {
  id: string;
  categoryId: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
};

export type StaffDocsFileShape = {
  version: 1;
  categories: StaffDocCategory[];
  articles: StaffDocArticle[];
};

-- CreateTable
CREATE TABLE "news_article" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,
    "lang" TEXT NOT NULL,
    "raw_sentiment" DECIMAL(4,3),
    "our_sentiment" DECIMAL(4,3),
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_pair_link" (
    "article_id" TEXT NOT NULL,
    "pair_id" TEXT NOT NULL,
    "relevance" DECIMAL(4,3) NOT NULL,
    "impact_score" DECIMAL(4,3) NOT NULL,

    CONSTRAINT "news_pair_link_pkey" PRIMARY KEY ("article_id","pair_id")
);

-- CreateTable
CREATE TABLE "news_entity" (
    "article_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_value" TEXT NOT NULL,

    CONSTRAINT "news_entity_pkey" PRIMARY KEY ("article_id","entity_type","entity_value")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_article_external_id_key" ON "news_article"("external_id");

-- AddForeignKey
ALTER TABLE "news_pair_link" ADD CONSTRAINT "news_pair_link_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_pair_link" ADD CONSTRAINT "news_pair_link_pair_id_fkey" FOREIGN KEY ("pair_id") REFERENCES "currency_pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_entity" ADD CONSTRAINT "news_entity_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

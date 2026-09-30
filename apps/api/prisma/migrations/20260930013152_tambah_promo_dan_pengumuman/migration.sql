-- AlterTable
ALTER TABLE "menus" ADD COLUMN     "promo_ends_at" TIMESTAMP(3),
ADD COLUMN     "promo_price" DECIMAL(14,2),
ADD COLUMN     "promo_starts_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link_label" TEXT,
    "link_href" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_is_active_starts_at_idx" ON "announcements"("is_active", "starts_at");

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { getDatabaseUrl } from './pool.js';
import {
  brands,
  categories,
  ingredients,
  nutritions,
  productIngredients,
  productPrices,
  products,
  productTags,
  productVariants,
  tags,
} from '../data/database.js';

dotenv.config();

const { Pool } = pg;

async function findWorkingPool(): Promise<{ pool: pg.Pool; url: string }> {
  const url = getDatabaseUrl();
  if (!url || !url.trim()) {
    throw new Error('DATABASE_URL이 설정되어 있지 않습니다.');
  }

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: true, ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA } : {}) },
    connectionTimeoutMillis: 5000,
  });

  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  return { pool, url };
}

async function initSupabaseDb() {
  const { pool, url } = await findWorkingPool();

  const client = await pool.connect();

  try {
    console.log(
      `🔗 Supabase PostgreSQL 연결 성공! (${url.split('@')[1]})`
    );
    await client.query('BEGIN');

    // 1. schema.sql 실행 (테이블 생성)
    const schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await client.query(schemaSql);
    console.log(
      '✅ 1/6 테이블 생성 완료 (categories, brands, products, variants, prices, nutrition, ingredients, tags)'
    );

    // 2. Categories 시드
    for (const c of categories) {
      await client.query(
        `INSERT INTO categories (id, name, slug)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug`,
        [c.id, c.name, c.slug]
      );
    }

    // 3. Brands 시드
    for (const b of brands) {
      await client.query(
        `INSERT INTO brands (id, name, slug, is_active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, is_active = EXCLUDED.is_active`,
        [b.id, b.name, b.slug, b.isActive]
      );
    }

    // 4. Ingredients & Tags 시드
    for (const ing of ingredients) {
      await client.query(
        `INSERT INTO ingredients (id, name, slug, ingredient_group)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, ingredient_group = EXCLUDED.ingredient_group`,
        [ing.id, ing.name, ing.slug, ing.group]
      );
    }
    for (const t of tags) {
      await client.query(
        `INSERT INTO tags (id, name, slug)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug`,
        [t.id, t.name, t.slug]
      );
    }
    console.log('✅ 2/6 브랜드(6종), 재료(15종), 태그(6종) 시드 완료');

    // 5. Products 시드
    for (const p of products) {
      await client.query(
        `INSERT INTO products (id, brand_id, category_id, name, slug, description, status, is_limited)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           brand_id = EXCLUDED.brand_id,
           category_id = EXCLUDED.category_id,
           name = EXCLUDED.name,
           slug = EXCLUDED.slug,
           description = EXCLUDED.description,
           status = EXCLUDED.status`,
        [
          p.id,
          p.brandId,
          p.categoryId,
          p.name,
          p.slug,
          p.description,
          p.status,
          p.isLimited,
        ]
      );
    }
    console.log('✅ 3/6 햄버거 상품(18종) 시드 완료');

    // 6. Product Variants, Prices, Nutrition 시드
    for (const v of productVariants) {
      await client.query(
        `INSERT INTO product_variants (id, product_id, name, variant_type, is_default, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           product_id = EXCLUDED.product_id,
           name = EXCLUDED.name,
           variant_type = EXCLUDED.variant_type,
           is_default = EXCLUDED.is_default`,
        [v.id, v.productId, v.name, v.variantType, v.isDefault, v.isActive]
      );
    }

    for (const pp of productPrices) {
      await client.query(
        `INSERT INTO product_prices (id, product_variant_id, price, channel, started_at, ended_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           price = EXCLUDED.price,
           channel = EXCLUDED.channel`,
        [
          pp.id,
          pp.productVariantId,
          pp.price,
          pp.channel,
          pp.startedAt,
          pp.endedAt,
        ]
      );
    }

    for (const n of nutritions) {
      await client.query(
        `INSERT INTO nutrition (id, product_variant_id, serving_size_g, calories_kcal, protein_g, sugar_g, saturated_fat_g, sodium_mg)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (product_variant_id) DO UPDATE SET
           serving_size_g = EXCLUDED.serving_size_g,
           calories_kcal = EXCLUDED.calories_kcal,
           protein_g = EXCLUDED.protein_g,
           sugar_g = EXCLUDED.sugar_g,
           saturated_fat_g = EXCLUDED.saturated_fat_g,
           sodium_mg = EXCLUDED.sodium_mg`,
        [
          n.id,
          n.productVariantId,
          n.servingSizeG,
          n.caloriesKcal,
          n.proteinG,
          n.sugarG,
          n.saturatedFatG,
          n.sodiumMg,
        ]
      );
    }
    console.log(
      '✅ 4/6 단품/세트 Variant(36개), 매장/배달 가격(72개), 영양성분(36개) 시드 완료'
    );

    // 7. Product Ingredients & Product Tags 매핑 시드
    for (const pi of productIngredients) {
      await client.query(
        `INSERT INTO product_ingredients (product_id, ingredient_id, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, ingredient_id) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
        [pi.productId, pi.ingredientId, pi.sortOrder]
      );
    }

    for (const pt of productTags) {
      await client.query(
        `INSERT INTO product_tags (product_id, tag_id)
         VALUES ($1, $2)
         ON CONFLICT (product_id, tag_id) DO NOTHING`,
        [pt.productId, pt.tagId]
      );
    }

    // Sequence 동기화
    const seqTables = [
      'categories',
      'brands',
      'products',
      'product_variants',
      'product_prices',
      'nutrition',
      'ingredients',
      'tags',
    ];
    for (const tbl of seqTables) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${tbl}', 'id'), COALESCE((SELECT MAX(id) FROM ${tbl}), 1), true)`
      );
    }

    await client.query('COMMIT');
    console.log(
      '🎉 6/6 Supabase 데이터베이스 초기화 및 초기 시드 데이터 입력이 모두 완료되었습니다!'
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ DB 초기화 중 오류가 발생했습니다:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initSupabaseDb();

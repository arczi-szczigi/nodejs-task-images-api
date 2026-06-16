import { MigrationInterface, QueryRunner } from "typeorm";

export class InitImages1781638278849 implements MigrationInterface {
    name = 'InitImages1781638278849'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Required for uuid_generate_v4() used by the uuid primary key.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "storageKey" character varying(255) NOT NULL, "width" integer NOT NULL, "height" integer NOT NULL, "format" character varying(20) NOT NULL, "sizeBytes" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1fe148074c6a1a91b63cb9ee3c9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e1efd225eb995fc5e2bf9dfe8a" ON "images" ("title") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_e1efd225eb995fc5e2bf9dfe8a"`);
        await queryRunner.query(`DROP TABLE "images"`);
    }

}

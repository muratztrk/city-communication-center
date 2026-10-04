using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeRequestTagAndTemplateNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Veri düzeltmesi (#6ac20baf / #6ac20c40): Talep etiketi adı ilk harf büyük; aynı adlı etiketler
            // tek kayıtta birleşir (en eski kalır, mesajlardaki etiket adları ona çevrilir, fazlalar silinir);
            // Kişisel şablon adının yalnız ilk harfi büyütülür. Türkçe i/ı eşlemesi translate ile elle yapılır
            // (veritabanı locale'ine bağlı upper() güvenilmez).
            migrationBuilder.Sql("""
CREATE OR REPLACE FUNCTION pg_temp.ccc_cap(s text) RETURNS text AS $f$
  SELECT CASE WHEN s IS NULL OR length(s) = 0 THEN s
    ELSE translate(left(s, 1), 'abcçdefgğhıijklmnoöpqrsştuüvwxyz', 'ABCÇDEFGĞHIİJKLMNOÖPQRSŞTUÜVWXYZ') || substr(s, 2) END
$f$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION pg_temp.ccc_key(s text) RETURNS text AS $f$
  SELECT regexp_replace(btrim(translate(s, 'ABCÇDEFGĞHIİJKLMNOÖPQRSŞTUÜVWXYZ', 'abcçdefgğhıijklmnoöpqrsştuüvwxyz')), '\s+', ' ', 'g')
$f$ LANGUAGE sql IMMUTABLE;

UPDATE userquickreplytemplates
SET name = pg_temp.ccc_cap(btrim(name))
WHERE name IS DISTINCT FROM pg_temp.ccc_cap(btrim(name));

CREATE TEMP TABLE ccc_tag_map ON COMMIT DROP AS
SELECT t.tagid, t.tenantid, pg_temp.ccc_key(t.name) AS key, pg_temp.ccc_cap(btrim(t.name)) AS newname,
       row_number() OVER (PARTITION BY t.tenantid, pg_temp.ccc_key(t.name) ORDER BY t.createdatutc, t.tagid) AS rn
FROM requesttags t;

CREATE TEMP TABLE ccc_tag_canon ON COMMIT DROP AS
SELECT tenantid, key, newname AS canon FROM ccc_tag_map WHERE rn = 1;

UPDATE socialmessages m
SET tags = n.newtags
FROM (
  SELECT m2.socialmessageid,
         (SELECT string_agg(x.tok, ';' ORDER BY x.first_ord)
          FROM (SELECT coalesce(c.canon, btrim(u.t)) AS tok, min(u.ord) AS first_ord
                FROM unnest(string_to_array(m2.tags, ';')) WITH ORDINALITY AS u(t, ord)
                LEFT JOIN ccc_tag_canon c ON c.tenantid = m2.tenantid AND c.key = pg_temp.ccc_key(u.t)
                WHERE btrim(u.t) <> ''
                GROUP BY coalesce(c.canon, btrim(u.t))) x) AS newtags
  FROM socialmessages m2
  WHERE m2.tags IS NOT NULL AND m2.tags <> ''
) n
WHERE n.socialmessageid = m.socialmessageid AND m.tags IS DISTINCT FROM n.newtags;

DELETE FROM requesttags t USING ccc_tag_map m WHERE m.tagid = t.tagid AND m.rn > 1;

UPDATE requesttags t SET name = m.newname
FROM ccc_tag_map m WHERE m.tagid = t.tagid AND m.rn = 1 AND t.name <> m.newname;
""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Veri düzeltmesi geri alınamaz.
        }
    }
}

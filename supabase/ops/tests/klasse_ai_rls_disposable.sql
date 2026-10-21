-- Disposable PostgreSQL RLS execution test with entirely synthetic data.
-- Important: this proves the intended isolation contract in real PostgreSQL,
-- NOT that every production KLASSE migration/policy has been applied.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA klasse_ai_fixture;
CREATE ROLE klasse_ai_fixture_auth NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA klasse_ai_fixture TO klasse_ai_fixture_auth;
CREATE TABLE klasse_ai_fixture.assignments (
  school text NOT NULL, campus text NOT NULL, class text NOT NULL,
  student text NOT NULL, official_raa text NOT NULL,
  PRIMARY KEY (school, campus, class, student)
);
INSERT INTO klasse_ai_fixture.assignments VALUES
 ('A','X','A-X-1','A-X-01','retido'),
 ('A','X','A-X-1','A-X-02','pendente'),
 ('A','Y','A-Y-1','A-Y-01','concluiu'),
 ('B','Z','B-Z-1','B-Z-01','retido');
GRANT SELECT ON klasse_ai_fixture.assignments TO klasse_ai_fixture_auth;
ALTER TABLE klasse_ai_fixture.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE klasse_ai_fixture.assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY synthetic_school_campus ON klasse_ai_fixture.assignments FOR SELECT
 TO klasse_ai_fixture_auth USING (
   (current_setting('ai.school', true) = school OR current_setting('ai.role', true) = 'general_admin')
   AND (current_setting('ai.campus', true) = campus OR current_setting('ai.role', true) IN ('director', 'general_admin'))
   AND current_setting('ai.role', true) IN ('secretary', 'director', 'general_admin')
 );
CREATE FUNCTION klasse_ai_fixture.raa_status(p_school text, p_campus text DEFAULT NULL)
RETURNS TABLE(class text, retained bigint, pending bigint, completed bigint)
LANGUAGE sql SECURITY INVOKER SET search_path = klasse_ai_fixture, pg_catalog AS $$
 SELECT a.class, count(*) FILTER (WHERE a.official_raa='retido'),
   count(*) FILTER (WHERE a.official_raa='pendente'),
   count(*) FILTER (WHERE a.official_raa='concluiu')
 FROM assignments a WHERE a.school = p_school AND (p_campus IS NULL OR a.campus = p_campus)
 GROUP BY a.class ORDER BY a.class;
$$;
GRANT EXECUTE ON FUNCTION klasse_ai_fixture.raa_status(text,text) TO klasse_ai_fixture_auth;
COMMIT;

CREATE FUNCTION pg_temp.assert_eq(label text, expected text, actual text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF expected IS DISTINCT FROM actual THEN
   RAISE EXCEPTION 'FAIL %: expected %, got %', label, expected, actual;
 END IF;
 RAISE NOTICE 'PASS %', label;
END $$;

-- Tests are executed with an actual non-bypass RLS database role.
SET ROLE klasse_ai_fixture_auth;
SELECT set_config('ai.school','A',false), set_config('ai.campus','X',false), set_config('ai.role','secretary',false);
SELECT pg_temp.assert_eq('secretary A/X sees only own campus','2',
 (SELECT count(*)::text FROM klasse_ai_fixture.assignments));
SELECT pg_temp.assert_eq('secretary A/X cannot read campus Y via direct RPC','0',
 (SELECT count(*)::text FROM klasse_ai_fixture.raa_status('A','Y')));
SELECT pg_temp.assert_eq('secretary A/X cannot read school B via direct RPC','0',
 (SELECT count(*)::text FROM klasse_ai_fixture.raa_status('B',NULL)));
SELECT pg_temp.assert_eq('prompt-injection-like school selector does not bypass RLS','0',
 (SELECT count(*)::text FROM klasse_ai_fixture.raa_status('B'' OR TRUE --',NULL)));
SELECT set_config('ai.campus','Y',false);
SELECT pg_temp.assert_eq('secretary A/Y cannot read campus X','1',
 (SELECT count(*)::text FROM klasse_ai_fixture.assignments));
SELECT set_config('ai.role','director',false);
SELECT pg_temp.assert_eq('director A can see all own campuses','3',
 (SELECT count(*)::text FROM klasse_ai_fixture.assignments));
SELECT pg_temp.assert_eq('director A cannot read school B','0',
 (SELECT count(*)::text FROM klasse_ai_fixture.raa_status('B',NULL)));
SELECT set_config('ai.school','B',false), set_config('ai.campus','Z',false);
SELECT pg_temp.assert_eq('director B cannot read school A','0',
 (SELECT count(*)::text FROM klasse_ai_fixture.raa_status('A',NULL)));
SELECT set_config('ai.role','general_admin',false);
SELECT pg_temp.assert_eq('general admin can see all schools','4',
 (SELECT count(*)::text FROM klasse_ai_fixture.assignments));
SELECT set_config('ai.role','finance',false);
SELECT pg_temp.assert_eq('finance denied even via direct RPC','0',
 (SELECT count(*)::text FROM klasse_ai_fixture.raa_status('B',NULL)));
SELECT set_config('ai.role','teacher',false);
SELECT pg_temp.assert_eq('teacher denied even via direct RPC','0',
 (SELECT count(*)::text FROM klasse_ai_fixture.raa_status('B',NULL)));
SELECT set_config('ai.role','student',false);
SELECT pg_temp.assert_eq('student denied even via direct RPC','0',
 (SELECT count(*)::text FROM klasse_ai_fixture.raa_status('B',NULL)));
RESET ROLE;
DROP SCHEMA klasse_ai_fixture CASCADE;
DROP ROLE klasse_ai_fixture_auth;

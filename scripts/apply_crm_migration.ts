import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const connectionString = process.env.DB_URL?.trim();
  if (!connectionString) {
    console.error('Missing DB_URL environment variable.');
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations/20270624100000_add_role_to_afiliado_membros.sql');
    console.log('Reading migration file:', migrationPath);
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    console.log('Connecting to Supabase...');
    console.log('Applying migration...');
    
    // Execute the migration content
    await sql.unsafe(sqlContent);
    
    console.log('Migration applied successfully!');
    
    // Track migration in supabase_migrations table if it exists
    try {
      console.log('Registering migration in supabase_migrations.schema_migrations...');
      await sql`
        INSERT INTO supabase_migrations.schema_migrations (version)
        VALUES ('20270624100000')
        ON CONFLICT (version) DO NOTHING;
      `;
      console.log('Migration registered successfully!');
    } catch (regError) {
      console.log('Note: could not register in schema_migrations table (may not exist or permission denied), but SQL applied. Error:', regError);
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

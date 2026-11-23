#!/usr/bin/env bash
# Aplica las migraciones sobre un PostgreSQL vacío (imitando lo mínimo de Supabase) y ejecuta las pruebas SQL.
# Se ejecuta solo en GitHub Actions (flujo "Pruebas"). Si algo falla, se para y enseña el error.
set -euo pipefail
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}" PGPASSWORD="${PGPASSWORD:-postgres}"

psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists opi_test" -c "create database opi_test"
export PGDATABASE=opi_test

ejecutar() {
  echo
  echo "=== $1 ==="
  psql -v ON_ERROR_STOP=1 -q -f "$1"
}

ejecutar tests/sql/stub_supabase.sql
for f in supabase/migrations/*.sql; do ejecutar "$f"; done
for f in tests/sql/[0-9][0-9]_*.sql; do ejecutar "$f"; done

echo
echo "TODAS LAS PRUEBAS SQL HAN PASADO"

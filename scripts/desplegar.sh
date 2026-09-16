#!/usr/bin/env bash
# =====================================================================
# desplegar.sh — Despliegue completo (BYOK) a Cloudflare Pages + D1
# =====================================================================
# Este script hace TODO el despliegue de una sola pasada y es
# IDEMPOTENTE: si lo vuelves a ejecutar, reutiliza lo que ya existe
# (proyecto de Pages, base D1 y secreto JWT) en lugar de duplicarlo.
#
# Pasos que ejecuta:
#   1. Verifica que CLOUDFLARE_API_TOKEN esté disponible.
#   2. Crea el proyecto de Cloudflare Pages (si no existe).
#   3. Crea la base de datos D1 remota (si no existe) y obtiene su ID.
#   4. Sustituye PLACEHOLDER_DATABASE_ID en wrangler.jsonc.
#   5. Genera JWT_SECRET y lo guarda como secreto de Pages.
#   6. Aplica las migraciones y carga el seed de datos de ejemplo.
#   7. Compila y despliega en Cloudflare Pages.
#
# Uso:
#   cd /home/user/webapp
#   set -a && . ./.deploy.env && set +a   # exporta tu CLOUDFLARE_API_TOKEN
#   ./scripts/desplegar.sh
#
# Variables opcionales de entorno:
#   CLOUDFLARE_API_TOKEN   (obligatoria)
#   CF_PAGES_PROJECT       nombre del proyecto Pages  (def. cita-medica-consultorio)
#   D1_DATABASE_NAME       nombre de la base D1      (def. webapp-production)
#   CF_PRODUCTION_BRANCH   rama de producción        (def. main)
# =====================================================================

set -euo pipefail

PROYECTO="${CF_PAGES_PROJECT:-cita-medica-consultorio}"
DB_NAME="${D1_DATABASE_NAME:-webapp-production}"
RAMO="${CF_PRODUCTION_BRANCH:-main}"
WR="npx wrangler"

# Nos situamos siempre en la raíz del proyecto, la invoque quien la invoque.
cd "$(dirname "$0")/.."
echo "==> Directorio de trabajo: $(pwd)"

# ---------------------------------------------------------------------
# 1. Autenticación
# ---------------------------------------------------------------------
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  cat >&2 <<'MSG'

  ERROR: CLOUDFLARE_API_TOKEN no está definido en el entorno.

  Pega tu API Token de Cloudflare en la pestaña "Deploy" del proyecto
  (permisos necesarios: "Cloudflare Pages: Edit" y "D1: Edit") y
  vuelve a ejecutar este script.

  No se intenta `wrangler login` ni OAuth: no funcionan en este sandbox.

MSG
  exit 1
fi

echo "==> Verificando autenticación con Cloudflare..."
$WR whoami

# ---------------------------------------------------------------------
# 2. Proyecto de Cloudflare Pages (idempotente)
# ---------------------------------------------------------------------
echo "==> Proyecto de Pages: $PROYECTO"

if $WR pages project list 2>/dev/null | grep -qw "$PROYECTO"; then
  echo "    Ya existe, se reutiliza."
else
  echo "    Creando..."
  $WR pages project create "$PROYECTO" \
    --production-branch "$RAMO" \
    --compatibility-date 2026-09-08
fi

# ---------------------------------------------------------------------
# 3. Base de datos D1 remota (idempotente)
# ---------------------------------------------------------------------
echo "==> Base de datos D1: $DB_NAME"

DB_ID=""

# Intentamos primero localizarla en la lista de bases existentes.
if command -v jq >/dev/null 2>&1; then
  DB_ID="$(
    $WR d1 list --json 2>/dev/null \
      | jq -r --arg n "$DB_NAME" '.[]? | select(.name == $n) | .uuid' \
      | head -1
  )" || true
fi

if [ -z "$DB_ID" ]; then
  echo "    No existe todavía; creándola..."
  SALIDA="$($WR d1 create "$DB_NAME" 2>&1 || true)"
  printf '%s\n' "$SALIDA"
  DB_ID="$(
    printf '%s' "$SALIDA" \
      | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
      | head -1
  )" || true
else
  echo "    Ya existe, se reutiliza."
fi

if [ -z "$DB_ID" ]; then
  echo "  ERROR: no se pudo obtener el database_id de '$DB_NAME'." >&2
  echo "  Revisa la salida de 'npx wrangler d1 list' con tu token." >&2
  exit 1
fi

echo "    database_id = $DB_ID"

# ---------------------------------------------------------------------
# 4. Sustituir el marcador de posición en wrangler.jsonc
# ---------------------------------------------------------------------
echo "==> Actualizando wrangler.jsonc"
sed -i "s/PLACEHOLDER_DATABASE_ID/${DB_ID}/g" wrangler.jsonc
grep -n 'database_id' wrangler.jsonc

# ---------------------------------------------------------------------
# 5. JWT_SECRET como secreto de Pages (idempotente)
# ---------------------------------------------------------------------
echo "==> Secreto JWT_SECRET"

if $WR pages secret list --project-name "$PROYECTO" 2>/dev/null | grep -q 'JWT_SECRET'; then
  echo "    Ya está configurado; no se toca (cambiarlo invalidaría las sesiones)."
else
  # 48 bytes en base64 ≈ 64 caracteres de entropía.
  SECRETO="$(openssl rand -base64 48 | tr -d '\n')"
  printf '%s' "$SECRETO" | $WR pages secret put JWT_SECRET --project-name "$PROYECTO"
  echo "    Generado y guardado (no se muestra en pantalla)."
fi

# ---------------------------------------------------------------------
# 6. Migraciones y seed en la base remota
# ---------------------------------------------------------------------
echo "==> Aplicando migraciones a la base remota"
$WR d1 migrations apply "$DB_NAME" --remote

echo "==> Cargando datos de ejemplo (seed)"
$WR d1 execute "$DB_NAME" --remote --file=./seed.sql

# ---------------------------------------------------------------------
# 7. Compilar y desplegar
# ---------------------------------------------------------------------
echo "==> Compilando"
npm run build

echo "==> Desplegando en Cloudflare Pages"
$WR pages deploy dist --project-name "$PROYECTO"

cat <<MSG

=========================================================================
  Despliegue completado
=========================================================================
  Producción : https://${PROYECTO}.pages.dev
  Rama main  : https://main.${PROYECTO}.pages.dev

  Cuentas de prueba (contraseña Demo1234):
    paciente@demo.test     (paciente)
    recepcion@demo.test    (recepción / administrador)
    laura.mendez@consultorio.test  (médico)

  Comprobación rápida:
    curl https://${PROYECTO}.pages.dev/api/health
=========================================================================
MSG

# Crea en tu PostgreSQL local la base "mis_gastos" y un usuario propio para la app,
# y guarda la configuración en backend\.env (que no se sube a git).
#
# Uso (desde la carpeta mis-gastos):
#   powershell -ExecutionPolicy Bypass -File scripts\crear-base.ps1
#
# Te va a pedir la contraseña del usuario "postgres" (la que elegiste al instalar PostgreSQL).
# Se puede correr más de una vez: si la base ya existe, solo regenera la contraseña del usuario.

$ErrorActionPreference = 'Stop'

$pgDir = Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
    Sort-Object { [int]$_.Name } -Descending | Select-Object -First 1
if (-not $pgDir) {
    Write-Host 'No encontré PostgreSQL en C:\Program Files\PostgreSQL. ¿Está instalado?' -ForegroundColor Red
    exit 1
}
$psql = Join-Path $pgDir.FullName 'bin\psql.exe'

# Contraseña aleatoria para el usuario de la app (solo letras y números)
$chars = [char[]]'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
$password = -join (1..24 | ForEach-Object { $chars | Get-Random })

$sql = @'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mis_gastos') THEN
    CREATE ROLE mis_gastos LOGIN PASSWORD '__PASSWORD__';
  ELSE
    ALTER ROLE mis_gastos WITH LOGIN PASSWORD '__PASSWORD__';
  END IF;
END
$$;
SELECT 'CREATE DATABASE mis_gastos OWNER mis_gastos ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mis_gastos')\gexec
'@.Replace('__PASSWORD__', $password)

$tempFile = New-TemporaryFile
try {
    Set-Content -Path $tempFile -Value $sql -Encoding ascii
    Write-Host "Usando $psql"
    Write-Host 'Ingresá la contraseña del usuario "postgres":' -ForegroundColor Cyan
    & $psql -U postgres -h localhost -v ON_ERROR_STOP=1 -q -f $tempFile
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'No se pudo crear la base. Revisá la contraseña de "postgres".' -ForegroundColor Red
        exit 1
    }
} finally {
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}

$envFile = Join-Path $PSScriptRoot '..\backend\.env'
@(
    'DATABASE_URL=jdbc:postgresql://localhost:5432/mis_gastos'
    'DB_USERNAME=mis_gastos'
    "DB_PASSWORD=$password"
) | Set-Content -Path $envFile -Encoding ascii

Write-Host ''
Write-Host 'Listo: base "mis_gastos" creada y configuración guardada en backend\.env' -ForegroundColor Green
Write-Host 'Ahora podés levantar la app:  cd backend  y  mvn spring-boot:run'

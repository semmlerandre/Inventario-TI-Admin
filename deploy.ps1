# ============================================================
#  Inventario TI - Script de Deploy (Windows PowerShell)
#  Requer: Windows 10/11 64-bit, PowerShell 5.1+
# ============================================================

param(
    [string]$AppDir = "C:\inventario-ti",
    [string]$RepoUrl = "https://github.com/semmlerandre/Inventario-TI-Admin.git"
)

$ErrorActionPreference = "Stop"

function Write-Info    { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn    { param($msg) Write-Host "[AVS]  $msg" -ForegroundColor Yellow }
function Write-Err     { param($msg) Write-Host "[ERRO] $msg" -ForegroundColor Red; exit 1 }

Clear-Host
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Inventario TI - Deploy Automatico    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# PASSO 1: Verificar Docker
# ============================================================
Write-Info "Verificando Docker..."

$dockerInstalled = $false
try {
    $dockerVer = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerInstalled = $true
        Write-Success "Docker encontrado: $dockerVer"
    }
} catch { }

if (-not $dockerInstalled) {
    Write-Warn "Docker Desktop nao encontrado!"
    Write-Host ""
    Write-Host "  Para instalar o Docker Desktop no Windows:" -ForegroundColor Yellow
    Write-Host "  1. Acesse: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    Write-Host "  2. Baixe e instale o Docker Desktop" -ForegroundColor Yellow
    Write-Host "  3. Reinicie o computador" -ForegroundColor Yellow
    Write-Host "  4. Execute este script novamente" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Abrindo pagina de download..." -ForegroundColor Cyan
    Start-Process "https://www.docker.com/products/docker-desktop/"
    exit 1
}

# Verificar se Docker daemon está rodando
try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Docker esta instalado mas nao esta rodando. Abra o Docker Desktop e tente novamente."
    }
} catch {
    Write-Err "Docker esta instalado mas nao esta rodando. Abra o Docker Desktop e tente novamente."
}

# ============================================================
# PASSO 2: Verificar Docker Compose
# ============================================================
$composeCmd = $null

try {
    docker compose version 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $composeCmd = "docker compose"
        Write-Success "Docker Compose (plugin) encontrado."
    }
} catch { }

if (-not $composeCmd) {
    try {
        docker-compose --version 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $composeCmd = "docker-compose"
            Write-Success "Docker Compose (standalone) encontrado."
        }
    } catch { }
}

if (-not $composeCmd) {
    Write-Err "Docker Compose nao encontrado. Atualize o Docker Desktop para a versao mais recente."
}

# ============================================================
# PASSO 3: Verificar Git
# ============================================================
Write-Info "Verificando Git..."
$gitInstalled = $false
try {
    $gitVer = git --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $gitInstalled = $true
        Write-Success "Git encontrado: $gitVer"
    }
} catch { }

if (-not $gitInstalled) {
    Write-Warn "Git nao encontrado! Instalando via winget..."
    try {
        winget install --id Git.Git -e --source winget --silent
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-Success "Git instalado!"
    } catch {
        Write-Host ""
        Write-Host "  Nao foi possivel instalar o Git automaticamente." -ForegroundColor Yellow
        Write-Host "  Baixe e instale manualmente: https://git-scm.com/download/win" -ForegroundColor Yellow
        Start-Process "https://git-scm.com/download/win"
        exit 1
    }
}

# ============================================================
# PASSO 4: Clonar ou atualizar repositório
# ============================================================
if (Test-Path (Join-Path $AppDir ".git")) {
    Write-Info "Projeto ja existe em $AppDir. Atualizando..."
    Set-Location $AppDir
    git pull origin main 2>&1
    if ($LASTEXITCODE -ne 0) {
        git pull origin master 2>&1
    }
    Write-Success "Codigo atualizado!"
} else {
    Write-Info "Clonando repositorio para $AppDir..."
    $parentDir = Split-Path $AppDir -Parent
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Force -Path $parentDir | Out-Null
    }
    git clone $RepoUrl $AppDir
    Set-Location $AppDir
    Write-Success "Repositorio clonado!"
}

Set-Location $AppDir

# ============================================================
# PASSO 5: Configurar .env se não existir
# ============================================================
if (-not (Test-Path ".env")) {
    Write-Info "Criando arquivo de configuracao .env..."
    Copy-Item ".env.example" ".env"

    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%"
    $secret = -join (1..64 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })

    $envContent = Get-Content ".env" -Raw
    $envContent = $envContent -replace "SESSION_SECRET=.*", "SESSION_SECRET=$secret"
    Set-Content ".env" $envContent

    Write-Warn "Arquivo .env criado com configuracoes padrao."
    Write-Warn "Voce pode editar $AppDir\.env para personalizar as configuracoes."
    Write-Host ""
    Write-Host "  Pressione ENTER para continuar, ou feche e edite o .env primeiro." -ForegroundColor Yellow
    Read-Host
} else {
    Write-Success "Arquivo .env ja existe, mantendo configuracoes atuais."
}

# ============================================================
# PASSO 6: Build e inicialização dos containers
# ============================================================
Write-Info "Verificando containers em execucao..."
$runningServices = Invoke-Expression "$composeCmd ps --services 2>&1"
if ($runningServices) {
    Write-Info "Parando containers antigos..."
    Invoke-Expression "$composeCmd down" | Out-Null
}

Write-Info "Construindo imagem Docker (pode demorar alguns minutos na primeira vez)..."
Invoke-Expression "$composeCmd build --no-cache"
if ($LASTEXITCODE -ne 0) { Write-Err "Falha no build da imagem Docker." }

Write-Info "Iniciando containers..."
Invoke-Expression "$composeCmd up -d"
if ($LASTEXITCODE -ne 0) { Write-Err "Falha ao iniciar os containers." }

# ============================================================
# PASSO 7: Status final
# ============================================================
Write-Info "Aguardando a aplicacao inicializar..."
Start-Sleep -Seconds 20

$envFile = Get-Content ".env" | Where-Object { $_ -match "^APP_PORT=" }
$appPort = if ($envFile) { ($envFile -split "=")[1].Trim() } else { "5000" }
$serverIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" } | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Deploy concluido com sucesso!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Aplicacao:  http://localhost:$appPort" -ForegroundColor Green
if ($serverIP) {
    Write-Host "  Rede local: http://${serverIP}:$appPort" -ForegroundColor Green
}
Write-Host ""
Write-Host "  Login padrao:" -ForegroundColor Cyan
Write-Host "    Usuario: admin" -ForegroundColor White
Write-Host "    Senha:   admin123" -ForegroundColor White
Write-Host ""
Write-Host "  Comandos uteis:" -ForegroundColor Yellow
Write-Host "    Ver logs:   cd $AppDir; $composeCmd logs -f app" -ForegroundColor White
Write-Host "    Reiniciar:  cd $AppDir; $composeCmd restart" -ForegroundColor White
Write-Host "    Parar:      cd $AppDir; $composeCmd down" -ForegroundColor White
Write-Host "    Atualizar:  powershell -File $AppDir\deploy.ps1" -ForegroundColor White
Write-Host ""

Invoke-Expression "$composeCmd ps"

Write-Host ""
Write-Host "  Abrindo aplicacao no navegador..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
Start-Process "http://localhost:$appPort"

# ================================================================
#  Inventario TI — Script de Instalação/Atualização (Windows)
#
#  Requisitos:
#    - Windows 10/11 64-bit (build 19041+)
#    - PowerShell 5.1 ou superior
#    - Conexão com a internet
#
#  Comportamento:
#    - Docker Desktop é OBRIGATÓRIO no Windows
#    - Se não estiver instalado, tenta instalar via winget
#    - Detecta instalação existente vs. nova automaticamente
#
#  Como usar (PowerShell como Administrador):
#    Set-ExecutionPolicy Bypass -Scope Process -Force
#    .\deploy.ps1
#
#  Ou via internet:
#    irm https://raw.githubusercontent.com/semmlerandre/Inventario-TI-Admin/main/deploy.ps1 | iex
# ================================================================

param(
    [string]$AppDir   = "C:\inventario-ti",
    [string]$RepoUrl  = "https://github.com/semmlerandre/Inventario-TI-Admin.git",
    [string]$Branch   = "main"
)

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

# ── Funções de log ───────────────────────────────────────────────
function Write-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║       Inventario TI — Deploy Automático      ║" -ForegroundColor Cyan
    Write-Host "  ║        Windows · Instalação / Atualização    ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Repositório: $RepoUrl" -ForegroundColor Gray
    Write-Host "  Diretório:   $AppDir"  -ForegroundColor Gray
    Write-Host ""
}

function Write-Step   { param($msg) Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-Info   { param($msg) Write-Host "  [INFO]  $msg" -ForegroundColor White }
function Write-Ok     { param($msg) Write-Host "  [OK]    $msg" -ForegroundColor Green }
function Write-Warn   { param($msg) Write-Host "  [AVISO] $msg" -ForegroundColor Yellow }
function Write-Fail   { param($msg) Write-Host "  [ERRO]  $msg" -ForegroundColor Red; exit 1 }

function Invoke-Compose {
    param([string]$Args)
    $cmd = $script:ComposeCmd + " " + $Args
    Invoke-Expression $cmd
    if ($LASTEXITCODE -ne 0) { Write-Fail "Falha no comando: $cmd" }
}

function Test-IsAdmin {
    $identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal] $identity
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") +
                ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
}

function Get-RandomSecret {
    param([int]$Length = 64)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return -join (1..$Length | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

# ================================================================
# INICIAR
# ================================================================
Write-Banner

# ── Verificar privilégios ─────────────────────────────────────
if (-not (Test-IsAdmin)) {
    Write-Warn "Este script precisa ser executado como Administrador."
    Write-Host ""
    Write-Host "  Reiniciando com privilégios elevados..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -AppDir `"$AppDir`" -RepoUrl `"$RepoUrl`" -Branch `"$Branch`""
    exit 0
}

# ================================================================
# PASSO 1: Verificar WSL2 (necessário para Docker Desktop)
# ================================================================
Write-Step "Verificando WSL2..."

$wslInstalled = $false
try {
    $wslStatus = wsl --status 2>&1
    if ($LASTEXITCODE -eq 0 -or ($wslStatus -match "WSL" -and $wslStatus -match "2")) {
        $wslInstalled = $true
        Write-Ok "WSL2 disponível."
    }
} catch { }

if (-not $wslInstalled) {
    Write-Warn "WSL2 não detectado. Instalando (necessário para Docker)..."
    try {
        wsl --install --no-distribution 2>&1 | Out-Null
        Write-Ok "WSL2 instalado."
        Write-Warn "Pode ser necessário reiniciar o computador antes de continuar."
    } catch {
        Write-Warn "Não foi possível instalar WSL2 automaticamente."
        Write-Host ""
        Write-Host "  Execute manualmente no PowerShell como Admin:" -ForegroundColor Yellow
        Write-Host "    wsl --install" -ForegroundColor White
        Write-Host "  Em seguida reinicie o PC e rode este script novamente." -ForegroundColor Yellow
    }
}

# ================================================================
# PASSO 2: Verificar / Instalar Docker Desktop
# ================================================================
Write-Step "Verificando Docker Desktop..."

$script:ComposeCmd = $null
$dockerRunning     = $false

function Test-Docker {
    try {
        $v = & docker --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            & docker info 2>&1 | Out-Null
            return ($LASTEXITCODE -eq 0)
        }
    } catch { }
    return $false
}

$dockerRunning = Test-Docker

if (-not $dockerRunning) {
    Write-Warn "Docker Desktop não encontrado ou não está em execução."
    Write-Host ""

    # ── Tentar instalar via winget ────────────────────────────
    $wingetAvailable = $false
    try {
        winget --version 2>&1 | Out-Null
        $wingetAvailable = ($LASTEXITCODE -eq 0)
    } catch { }

    if ($wingetAvailable) {
        Write-Info "Instalando Docker Desktop via winget (pode demorar alguns minutos)..."
        try {
            winget install --id Docker.DockerDesktop -e --source winget --silent --accept-package-agreements --accept-source-agreements
            Write-Ok "Docker Desktop instalado!"
            Write-Host ""
            Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Yellow
            Write-Host "  ║  AÇÃO NECESSÁRIA:                                ║" -ForegroundColor Yellow
            Write-Host "  ║  1. Abra o Docker Desktop (ícone na bandeja)     ║" -ForegroundColor Yellow
            Write-Host "  ║  2. Aguarde o Docker inicializar (ícone verde)   ║" -ForegroundColor Yellow
            Write-Host "  ║  3. Execute este script novamente                ║" -ForegroundColor Yellow
            Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "  Abrindo Docker Desktop..." -ForegroundColor Cyan
            Start-Process "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
            Pause
            exit 0
        } catch {
            Write-Warn "Falha na instalação via winget: $_"
        }
    }

    # ── Fallback: baixar instalador manualmente ───────────────
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Yellow
    Write-Host "  ║  Docker Desktop é OBRIGATÓRIO no Windows!        ║" -ForegroundColor Yellow
    Write-Host "  ║                                                  ║" -ForegroundColor Yellow
    Write-Host "  ║  Baixando instalador automaticamente...          ║" -ForegroundColor Yellow
    Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Yellow
    Write-Host ""

    $installerPath = "$env:TEMP\DockerDesktopInstaller.exe"
    $dockerUrl     = "https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe"

    Write-Info "Baixando Docker Desktop Installer (~600MB)..."
    try {
        Invoke-WebRequest -Uri $dockerUrl -OutFile $installerPath -UseBasicParsing
        Write-Ok "Download concluído!"
        Write-Info "Executando instalador (siga as instruções na tela)..."
        Start-Process $installerPath -Wait
        Write-Ok "Instalação concluída!"
        Write-Host ""
        Write-Host "  Reinicie o computador e execute este script novamente." -ForegroundColor Yellow
        Pause
        exit 0
    } catch {
        Write-Host ""
        Write-Host "  Não foi possível instalar automaticamente." -ForegroundColor Red
        Write-Host "  Baixe manualmente em: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
        Start-Process "https://www.docker.com/products/docker-desktop/"
        Pause
        exit 1
    }
}

Write-Ok "Docker está em execução: $(docker --version)"

# ── Detectar Docker Compose ───────────────────────────────────
try {
    docker compose version 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $script:ComposeCmd = "docker compose"
        Write-Ok "Docker Compose (plugin) detectado."
    }
} catch { }

if (-not $script:ComposeCmd) {
    try {
        docker-compose --version 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $script:ComposeCmd = "docker-compose"
            Write-Ok "Docker Compose (standalone) detectado."
        }
    } catch { }
}

if (-not $script:ComposeCmd) {
    Write-Fail "Docker Compose não encontrado. Atualize o Docker Desktop para a versão mais recente."
}

# ================================================================
# PASSO 3: Verificar / Instalar Git
# ================================================================
Write-Step "Verificando Git..."

$gitOk = $false
try {
    $gv = git --version 2>&1
    $gitOk = ($LASTEXITCODE -eq 0)
} catch { }

if (-not $gitOk) {
    Write-Warn "Git não encontrado. Instalando via winget..."
    try {
        winget install --id Git.Git -e --source winget --silent --accept-package-agreements --accept-source-agreements
        Refresh-Path
        Write-Ok "Git instalado!"
    } catch {
        Write-Host ""
        Write-Host "  Instale o Git manualmente: https://git-scm.com/download/win" -ForegroundColor Yellow
        Start-Process "https://git-scm.com/download/win"
        Pause
        exit 1
    }
} else {
    Write-Ok "Git encontrado: $(git --version)"
}

# ================================================================
# PASSO 4: Clonar ou atualizar repositório
# ================================================================
Write-Step "Verificando repositório..."

$isFreshInstall = $false
$gitDir = Join-Path $AppDir ".git"

if (Test-Path $gitDir) {
    Write-Info "Projeto já existe em $AppDir. Atualizando..."
    Set-Location $AppDir
    git fetch --all 2>&1 | Out-Null
    git reset --hard "origin/$Branch" 2>&1
    if ($LASTEXITCODE -ne 0) {
        git reset --hard origin/master 2>&1
    }
    Write-Ok "Código atualizado para a versão mais recente!"
    $isFreshInstall = $false
} else {
    Write-Info "Clonando repositório para $AppDir..."
    $parentDir = Split-Path $AppDir -Parent
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Force -Path $parentDir | Out-Null
    }
    git clone $RepoUrl $AppDir 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Fail "Falha ao clonar repositório." }
    Set-Location $AppDir
    Write-Ok "Repositório clonado!"
    $isFreshInstall = $true
}

Set-Location $AppDir

# ================================================================
# PASSO 5: Configurar .env
# ================================================================
Write-Step "Configurando variáveis de ambiente..."

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
    } else {
        # Cria .env mínimo se não existir .env.example
        @"
APP_PORT=5000
DB_USER=inventario
DB_PASSWORD=inventario123
DB_NAME=inventario
DB_PORT=5432
SESSION_SECRET=PLACEHOLDER
"@ | Set-Content ".env"
    }

    $secret = Get-RandomSecret 64
    $envContent = Get-Content ".env" -Raw
    $envContent = $envContent -replace "SESSION_SECRET=.*", "SESSION_SECRET=$secret"
    Set-Content ".env" $envContent

    Write-Ok "Arquivo .env criado com configurações padrão."
    Write-Warn "Você pode editar $AppDir\.env para personalizar antes de continuar."
    Write-Host ""
    Write-Host "  Pressione ENTER para continuar com as configurações padrão." -ForegroundColor Yellow
    Read-Host
} else {
    Write-Ok "Arquivo .env já existe, mantendo configurações."
}

# ================================================================
# PASSO 6: Docker Compose — build e start
# ================================================================
Write-Step "Preparando containers..."

if ($isFreshInstall) {
    Write-Info "Removendo volumes antigos (nova instalação limpa)..."
    Invoke-Expression "$($script:ComposeCmd) down --volumes --remove-orphans 2>&1" | Out-Null
} else {
    Write-Info "Parando containers (dados do banco preservados)..."
    Invoke-Expression "$($script:ComposeCmd) down --remove-orphans 2>&1" | Out-Null
}

Write-Step "Construindo imagem Docker (pode demorar na 1ª vez)..."
Invoke-Expression "$($script:ComposeCmd) build --no-cache"
if ($LASTEXITCODE -ne 0) { Write-Fail "Falha no build da imagem Docker." }
Write-Ok "Imagem construída com sucesso!"

Write-Step "Iniciando serviços..."
Invoke-Expression "$($script:ComposeCmd) up -d"
if ($LASTEXITCODE -ne 0) { Write-Fail "Falha ao iniciar os containers." }
Write-Ok "Containers iniciados!"

# ================================================================
# PASSO 7: Status final
# ================================================================
Write-Step "Aguardando aplicação inicializar (banco + migrações)..."
Start-Sleep -Seconds 25

# Ler porta do .env
$envLines = Get-Content ".env" -ErrorAction SilentlyContinue
$portLine  = $envLines | Where-Object { $_ -match "^APP_PORT=" }
$appPort   = if ($portLine) { ($portLine -split "=")[1].Trim() } else { "5000" }

# IP local
try {
    $serverIP = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.InterfaceAlias -notmatch "Loopback|vEthernet" } |
        Select-Object -First 1).IPAddress
} catch { $serverIP = $null }

# Verificar se containers subiram
$psOutput = Invoke-Expression "$($script:ComposeCmd) ps 2>&1"
$isUp = $psOutput -match "running|Up"

Write-Host ""
if ($isUp) {
    Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "  ║        Deploy concluído com sucesso!         ║" -ForegroundColor Green
    Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Aplicação:  http://localhost:$appPort" -ForegroundColor Green
    if ($serverIP) {
        Write-Host "  Rede local: http://${serverIP}:$appPort" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "  Credenciais padrão:" -ForegroundColor Cyan
    Write-Host "    Usuário: admin"    -ForegroundColor White
    Write-Host "    Senha:   admin123" -ForegroundColor White
    Write-Host ""
    Write-Host "  Comandos úteis (no PowerShell, dentro de $AppDir):" -ForegroundColor Yellow
    Write-Host "    Logs:       $($script:ComposeCmd) logs -f app"  -ForegroundColor White
    Write-Host "    Reiniciar:  $($script:ComposeCmd) restart"      -ForegroundColor White
    Write-Host "    Parar:      $($script:ComposeCmd) down"         -ForegroundColor White
    Write-Host "    Atualizar:  powershell -ExecutionPolicy Bypass -File $AppDir\deploy.ps1" -ForegroundColor White
    Write-Host ""
    Invoke-Expression "$($script:ComposeCmd) ps"
    Write-Host ""
    Write-Host "  Abrindo aplicação no navegador..." -ForegroundColor Cyan
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:$appPort"
} else {
    Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "  ║   ATENÇÃO: App pode não ter iniciado!        ║" -ForegroundColor Red
    Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Verifique os logs com:" -ForegroundColor Yellow
    Write-Host "    cd $AppDir"                                     -ForegroundColor White
    Write-Host "    $($script:ComposeCmd) logs app"                 -ForegroundColor White
    Write-Host ""
    Invoke-Expression "$($script:ComposeCmd) ps"
    Write-Host ""
    Invoke-Expression "$($script:ComposeCmd) logs --tail=50 app"
}

Write-Host ""

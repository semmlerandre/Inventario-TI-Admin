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
#    - Faz backup automático do banco antes de qualquer operação
#    - Restaura dados automaticamente se necessário
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

$BackupDir = Join-Path $AppDir "db-backup"

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
function Write-Backup { param($msg) Write-Host "  [BACKUP] $msg" -ForegroundColor Green }
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

# ── Funções de Backup/Restore (Docker) ──────────────────────────
function Backup-DatabaseDocker {
    param([string]$DbUser, [string]$DbName)

    Write-Step "Fazendo backup do banco de dados antes de atualizar..."

    if (-not (Test-Path $script:BackupDir)) {
        New-Item -ItemType Directory -Force -Path $script:BackupDir | Out-Null
    }

    # Garante que o container do banco está rodando
    $containerRunning = $false
    try {
        $r = docker exec inventario-ti-db psql -U $DbUser -d $DbName -c "SELECT 1;" 2>&1
        $containerRunning = ($LASTEXITCODE -eq 0)
    } catch { }

    if (-not $containerRunning) {
        Write-Info "Iniciando container do banco para backup..."
        Invoke-Expression "$($script:ComposeCmd) up -d db 2>&1" | Out-Null
        $tries = 0
        while ($tries -lt 12) {
            Start-Sleep -Seconds 5
            try {
                docker exec inventario-ti-db psql -U $DbUser -d $DbName -c "SELECT 1;" 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) { $containerRunning = $true; break }
            } catch { }
            $tries++
        }
    }

    if ($containerRunning) {
        $timestamp  = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupFile = Join-Path $script:BackupDir "latest.sql"
        $backupTs   = Join-Path $script:BackupDir "backup_${timestamp}.sql"

        docker exec inventario-ti-db pg_dump `
            -U $DbUser `
            -d $DbName `
            --data-only `
            --column-inserts `
            --no-privileges 2>$null | Set-Content $backupFile -Encoding UTF8

        if (Test-Path $backupFile) {
            Copy-Item $backupFile $backupTs -Force
            $size = (Get-Item $backupFile).Length
            Get-Date -Format "yyyy-MM-dd HH:mm:ss" | Set-Content (Join-Path $script:BackupDir "timestamp") -Encoding UTF8

            if ($size -gt 100) {
                Write-Backup "Backup realizado → $backupFile ($size bytes)"
                Write-Backup "Cópia histórica → $backupTs"
            } else {
                Write-Warn "Backup vazio — banco pode não ter dados ainda."
            }
        }
    } else {
        Write-Warn "Não foi possível conectar ao banco para backup (pode ser nova instalação)."
    }
}

function Restore-DatabaseDocker {
    param([string]$DbUser, [string]$DbName)

    $backupFile = Join-Path $script:BackupDir "latest.sql"
    if (-not (Test-Path $backupFile)) {
        Write-Info "Nenhum backup encontrado — usando dados padrão."
        return
    }

    $size = (Get-Item $backupFile).Length
    if ($size -le 100) {
        Write-Info "Arquivo de backup vazio — pulando restauração."
        return
    }

    Write-Step "Verificando necessidade de restauração de dados..."

    # Aguarda banco ficar disponível
    $tries = 0
    $dbReady = $false
    while ($tries -lt 12) {
        Start-Sleep -Seconds 5
        try {
            docker exec inventario-ti-db psql -U $DbUser -d $DbName -c "SELECT 1;" 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) { $dbReady = $true; break }
        } catch { }
        $tries++
    }

    if (-not $dbReady) {
        Write-Warn "Banco não ficou disponível para restauração."
        return
    }

    $countResult = docker exec inventario-ti-db psql -U $DbUser -d $DbName -t -c "SELECT COUNT(*) FROM settings;" 2>&1
    $count = ($countResult | Select-Object -Last 1).Trim()

    if ($count -eq "0" -or [string]::IsNullOrWhiteSpace($count)) {
        Write-Backup "Banco vazio detectado — restaurando dados do backup..."

        $timestampFile = Join-Path $script:BackupDir "timestamp"
        $backupDate = if (Test-Path $timestampFile) { Get-Content $timestampFile } else { "data desconhecida" }

        docker cp $backupFile "inventario-ti-db:/tmp/restore.sql" 2>&1 | Out-Null
        docker exec inventario-ti-db psql -U $DbUser -d $DbName `
            -c "SET session_replication_role = replica;" `
            -f "/tmp/restore.sql" 2>&1 | Out-Null

        if ($LASTEXITCODE -eq 0) {
            Write-Backup "Dados restaurados com sucesso (backup de $backupDate)!"
        } else {
            Write-Warn "Restauração com avisos — conflitos ignorados, dados existentes mantidos."
        }
    } else {
        Write-Ok "Banco de dados com $count configuração(ões) — dados preservados, restauração não necessária."
    }
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

# Carrega variáveis do .env
$envLines = Get-Content ".env" -ErrorAction SilentlyContinue

# ================================================================
# PASSO 6: Verificar volume do banco (fonte de verdade real)
# ================================================================
Write-Step "Verificando volumes do banco de dados..."

# IMPORTANTE: Docker Compose preserva hífens no nome do projeto.
# Ex: diretório "inventario-ti" → projeto "inventario-ti" → volume "inventario-ti_postgres_data"
# NÃO remover hífens do nome — manter -replace '[^a-z0-9-]', ''
$projectName    = (Split-Path $AppDir -Leaf).ToLower() -replace '[^a-z0-9-]', ''
$postgresVolume = "${projectName}_postgres_data"

$dbVolumeExists = $false
try {
    docker volume inspect $postgresVolume 2>&1 | Out-Null
    $dbVolumeExists = ($LASTEXITCODE -eq 0)
} catch { }

if ($dbVolumeExists) {
    Write-Ok "Volume do banco encontrado: $postgresVolume (dados serão preservados)"

    # Carrega credenciais do .env para verificação
    $dbUser = ($envLines | Where-Object { $_ -match "^DB_USER=" }     | Select-Object -First 1) -replace "^DB_USER=", ""
    $dbName = ($envLines | Where-Object { $_ -match "^DB_NAME=" }     | Select-Object -First 1) -replace "^DB_NAME=", ""
    $dbUser = $dbUser.Trim()
    $dbName = $dbName.Trim()

    Write-Info "Verificando credenciais do banco de dados..."
    Invoke-Expression "$($script:ComposeCmd) up -d db 2>&1" | Out-Null
    Start-Sleep -Seconds 10

    $credOk = $false
    try {
        $testResult = docker exec inventario-ti-db psql -U $dbUser -d $dbName -c "SELECT 1;" 2>&1
        $credOk = ($LASTEXITCODE -eq 0)
    } catch { }

    if (-not $credOk) {
        Invoke-Expression "$($script:ComposeCmd) down --remove-orphans 2>&1" | Out-Null
        Write-Host ""
        Write-Host "  ╔════════════════════════════════════════════════════╗" -ForegroundColor Red
        Write-Host "  ║   CONFLITO DE CREDENCIAIS DETECTADO               ║" -ForegroundColor Red
        Write-Host "  ╠════════════════════════════════════════════════════╣" -ForegroundColor Red
        Write-Host "  ║  O banco já existe com credenciais diferentes     ║" -ForegroundColor Red
        Write-Host "  ║  das que estão no arquivo .env atual.             ║" -ForegroundColor Red
        Write-Host "  ╚════════════════════════════════════════════════════╝" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Escolha uma opção:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  [1] Corrigir o .env para usar as credenciais antigas" -ForegroundColor Green
        Write-Host "      (recomendado se você tem dados importantes)"       -ForegroundColor Gray
        Write-Host ""
        Write-Host "  [2] Apagar o banco e reinstalar do zero"    -ForegroundColor Red
        Write-Host "      ATENCAO: todos os dados serao perdidos!" -ForegroundColor Red
        Write-Host ""
        Write-Host "  [3] Cancelar" -ForegroundColor Yellow
        Write-Host ""
        $choice = Read-Host "  Digite 1, 2 ou 3 e pressione ENTER"

        switch ($choice) {
            "1" {
                Write-Host ""
                Write-Warn "Abra e edite o arquivo .env:"
                Write-Host "  $AppDir\.env" -ForegroundColor Cyan
                Write-Host ""
                Write-Host "  Ajuste DB_USER, DB_PASSWORD e DB_NAME para os valores" -ForegroundColor Yellow
                Write-Host "  usados quando o banco foi criado pela primeira vez."    -ForegroundColor Yellow
                Write-Host ""
                Write-Host "  Depois execute o script novamente:" -ForegroundColor Yellow
                Write-Host "  powershell -ExecutionPolicy Bypass -File $AppDir\deploy.ps1" -ForegroundColor White
                Pause; exit 0
            }
            "2" {
                Write-Warn "Removendo volume do banco (dados serao perdidos)..."
                docker volume rm $postgresVolume 2>&1 | Out-Null
                $dbVolumeExists = $false
                Write-Ok "Volume removido. Continuando com instalacao limpa..."
            }
            default {
                Write-Info "Operacao cancelada."
                exit 0
            }
        }
    } else {
        Write-Ok "Credenciais verificadas — banco acessível."

        # ── BACKUP antes de qualquer operação ──────────────────
        $script:BackupDir = $BackupDir
        Backup-DatabaseDocker -DbUser $dbUser -DbName $dbName
    }
} else {
    Write-Info "Nenhum volume de banco existente — instalação limpa."
}

# ================================================================
# PASSO 7: Docker Compose — build e start
# ================================================================
Write-Step "Preparando containers..."

if (-not $dbVolumeExists) {
    Write-Info "Removendo volumes antigos (nova instalação limpa)..."
    Invoke-Expression "$($script:ComposeCmd) down --volumes --remove-orphans 2>&1" | Out-Null
} else {
    Write-Info "Parando containers (dados do banco preservados no volume $postgresVolume)..."
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
# PASSO 8: Aguardar, restaurar e verificar
# ================================================================
Write-Step "Aguardando aplicação inicializar (banco + migrações)..."
Start-Sleep -Seconds 25

# ── RESTAURAR backup se banco estiver vazio ────────────────────
if ($dbVolumeExists -or (Test-Path (Join-Path $BackupDir "latest.sql"))) {
    $dbUser = ($envLines | Where-Object { $_ -match "^DB_USER=" } | Select-Object -First 1) -replace "^DB_USER=", ""
    $dbName = ($envLines | Where-Object { $_ -match "^DB_NAME=" } | Select-Object -First 1) -replace "^DB_NAME=", ""
    $script:BackupDir = $BackupDir
    Restore-DatabaseDocker -DbUser $dbUser.Trim() -DbName $dbName.Trim()
}

# Verificar erro de autenticação nos logs
$appLogs = Invoke-Expression "$($script:ComposeCmd) logs --tail=60 app 2>&1"
if ($appLogs -match "password authentication failed") {
    Write-Host ""
    Write-Host "  ╔═══════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "  ║   ERRO: Falha de autenticacao no banco de dados       ║" -ForegroundColor Red
    Write-Host "  ╠═══════════════════════════════════════════════════════╣" -ForegroundColor Red
    Write-Host "  ║  O volume do banco foi criado com credenciais         ║" -ForegroundColor Red
    Write-Host "  ║  diferentes das que estao no .env atual.              ║" -ForegroundColor Red
    Write-Host "  ╚═══════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Opcao A — Corrija o .env:" -ForegroundColor Green
    Write-Host "    Ajuste DB_USER, DB_PASSWORD, DB_NAME em: $AppDir\.env" -ForegroundColor White
    Write-Host "    Execute o script novamente."                            -ForegroundColor White
    Write-Host ""
    Write-Host "  Opcao B — Reinstalar do zero (apaga todos os dados):" -ForegroundColor Red
    Write-Host "    cd $AppDir"                                          -ForegroundColor White
    Write-Host "    $($script:ComposeCmd) down --volumes"               -ForegroundColor White
    Write-Host "    powershell -ExecutionPolicy Bypass -File deploy.ps1" -ForegroundColor White
    Write-Host ""
    Invoke-Expression "$($script:ComposeCmd) logs --tail=30 app"
    exit 1
}

# Ler porta do .env
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
    Write-Host "  Backups do banco:  $BackupDir\" -ForegroundColor Cyan
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
    Invoke-Expression "$($script:ComposeCmd) logs --tail=50 app"
}

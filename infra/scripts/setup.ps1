# =============================================================================
# 🚀 OPENCLINIC - SETUP WRAPPER (POWERSHELL / WINDOWS)
# =============================================================================
# Executa o assistente multiplataforma de setup do desenvolvedor.
# Uso: .\infra\scripts\setup.ps1 [-Quickstart] [-Demo] [-Stop] [-Secrets]
# =============================================================================

param (
    [switch]$Quickstart,
    [switch]$Demo,
    [switch]$Stop,
    [switch]$Secrets,
    [switch]$Help
)

$argsList = @()
if ($Quickstart) { $argsList += "--quickstart" }
if ($Demo) { $argsList += "--demo" }
if ($Stop) { $argsList += "--stop" }
if ($Secrets) { $argsList += "--secrets" }
if ($Help) { $argsList += "--help" }

node "$PSScriptRoot\setup.mjs" @argsList

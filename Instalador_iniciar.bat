@echo off
title Instalador do Sistema de Filas

:: --- Passo 1: Verificar e instalar o Node.js ---
echo Verificando a instalacao do Node.js...
node -v > nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js nao encontrado. Por favor, instale o Node.js para continuar.
    start https://nodejs.org/pt-br/download
    pause
    exit
) else (
    echo Node.js ja esta instalado.
)

:: --- Passo 2: Instalar as dependencias do projeto ---
echo.
echo Instalando as dependencias do projeto (pode demorar alguns minutos)...
npm install

:: --- Passo 3: Configurar o endereco IP ---
echo.
echo Configuracao do endereco IP do servidor...
echo O seu endereco IP local e crucial para que outros PCs possam aceder ao sistema.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| find "IPv4"') do set IP=%%a
set "IP=%IP: =%"
set /p IP_ATUAL=O seu endereco IP e: %IP_ATUAL%. Pretende usar este? (S/N)
if /i "%IP_ATUAL%" equ "S" (
    set SERVER_IP=%IP%
) else (
    set /p SERVER_IP="Por favor, insira o endereco IP do servidor (ex: 192.168.1.100): "
)

:: --- Passo 4: Atualizar o arquivo scripts.js ---
echo.
echo Atualizando o arquivo scripts.js com o endereco IP %SERVER_IP%...
setlocal enabledelayedexpansion
set "JS_FILE=.\public\scripts.js"
set "SERVER_URL=const SERVER_URL = 'http://%SERVER_IP%:3000';"
(for /f "delims=" %%i in ('type "!JS_FILE!"') do (
    set "line=%%i"
    if "!line:~0,18!" equ "const SERVER_URL" (
        echo !SERVER_URL!
    ) else (
        echo !line!
    )
))>"!JS_FILE!.tmp"
move /y "!JS_FILE!.tmp" "!JS_FILE!"

:: --- Passo 5: Iniciar o servidor ---
echo.
echo Configuracao concluida.
echo A iniciar o servidor...
echo.
node server.js
pause
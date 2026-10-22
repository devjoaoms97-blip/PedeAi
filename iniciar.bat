@echo off
title Pesqueiro Sao Jose - Sistema de Pedidos
cd /d "%~dp0"

rem Se o sistema ja estiver ligado (ex: iniciou sozinho com o Windows), nao abre outro.
netstat -ano | findstr /r /c:":3000 .*LISTENING" >nul
if %errorlevel%==0 (
  echo O sistema ja esta ligado em outra janela. Nada a fazer.
  timeout /t 8
  exit /b
)

echo ============================================
echo  Ligando o sistema de pedidos...
echo  NAO FECHE esta janela enquanto o restaurante
echo  estiver usando o cardapio (ela precisa ficar
echo  aberta em segundo plano).
echo ============================================
echo.

:ligar
call npm start
rem Se o sistema parar por algum erro, liga de novo sozinho depois de 5 segundos.
echo.
echo O sistema parou. Religando em 5 segundos... (feche a janela para desligar de vez)
timeout /t 5 /nobreak >nul
goto ligar

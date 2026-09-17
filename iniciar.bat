@echo off
title Pesqueiro Sao Jose - Sistema de Pedidos
cd /d "%~dp0"
echo ============================================
echo  Ligando o sistema de pedidos...
echo  NAO FECHE esta janela enquanto o restaurante
echo  estiver usando o cardapio (ela precisa ficar
echo  aberta em segundo plano).
echo ============================================
echo.
call npm start
pause

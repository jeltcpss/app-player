#!/bin/bash

# Criar diretório do frontend
mkdir -p api-de-musica-front

# Copiar arquivos do frontend
cp -r src/../api-de-musica-front/* api-de-musica-front/

# Exibir estrutura de arquivos
echo "Estrutura de arquivos após build:"
ls -la
ls -la api-de-musica-front/ 
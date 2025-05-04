@echo off
echo Running database reset script...
cd packages\backend
powershell -ExecutionPolicy Bypass -File src\scripts\set-db-url.ps1
cd ..\..

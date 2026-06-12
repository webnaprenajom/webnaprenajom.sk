# ADR 0001: Documentation Must Follow Architecture Changes

## Status
Accepted

## Context
CRM sa ďalej rozvíja cez samostatné batche, často s pomocou AI asistenta. Bez povinného procesu pre update dokumentácie by sa hlavný architektonický dokument rýchlo odpojil od reality kódu.

## Decision
Každá významná zmena architektúry, workflowu, dátového modelu alebo business logiky musí v tom istom batche aktualizovať aj dokumentáciu v repozitári.

## Consequences
- Architecture guide sa stáva living dokumentom.
- AI aj developer musia kontrolovať dopad zmien na dokumentáciu.
- Release notes a ADR záznamy sú povinnou súčasťou významných batchov.

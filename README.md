# VigiaCheck (versão real: certidão CEAT)

Pesquisa por CPF:
1. **Infosimples** emite a Certidão Eletrônica de Ações Trabalhistas (CEAT, serviço `ceat-digital`) em cada TRT configurado. Custa R$ 0,24 por TRT e leva poucos segundos.
2. **DataJud (CNJ)**, que é gratuito, traz os detalhes de cada processo listado (assuntos, vara, movimentações).

Importante: a CEAT só lista ações movidas **contra** a pessoa (polo passivo), em processos eletrônicos. Ações que o candidato moveu contra ex-empregadores não aparecem. Para isso seria preciso Jusbrasil ou Escavador.

## Arquivos

- `public/index.html`: a tela (login com senha, termo de uso, pesquisa, resultado, histórico).
- `netlify/functions/consultar.mjs`: o servidor. Os tokens ficam só aqui, nunca no navegador.
- `netlify.toml`: configuração do Netlify.

## Como colocar no ar

1. Suba esta pasta para um repositório no GitHub.
2. No Netlify: **Add new site → Import an existing project → GitHub** e escolha o repositório. Não precisa mudar nada no build.
3. Em **Site configuration → Environment variables**, crie:

| Variável | O que colocar |
|---|---|
| `INFOSIMPLES_TOKEN` | Token da sua conta Infosimples (painel da Infosimples → Token). |
| `SENHA_ACESSO` | A senha que o RH vai digitar para entrar. |
| `TRTS` | Os TRTs a pesquisar, separados por vírgula. Ex.: `2,15` (SP capital e interior). |
| `DATAJUD_API_KEY` | Opcional. Só se o CNJ trocar a chave pública. |

4. **Deploys → Trigger deploy**. Pronto.

## TRTs por estado

1 RJ · 2 SP (capital, Grande SP, Baixada) · 3 MG · 4 RS · 5 BA · 6 PE · 7 CE · 8 PA/AP · 9 PR · 10 DF/TO · 11 AM/RR · 12 SC · 13 PB · 14 RO/AC · 15 SP (interior) · 16 MA · 17 ES · 18 GO · 19 AL · 20 SE · 21 RN · 22 PI · 23 MT · 24 MS

Cada TRT é uma certidão cobrada pela Infosimples por pesquisa. Coloque só os estados de onde vêm os candidatos.

## Limites

- Processos muito novos podem ainda não estar no DataJud. Nesse caso aparece só o número.
- A certidão não inclui processos físicos nem arquivados definitivamente.
- Uso interno do RH. Ter entrado com ação trabalhista não pode ser motivo de recusa.

# Fonte de palavras por frequência

## O que está sendo usado

A aplicação usa arquivos públicos do repositório **hermitdave/FrequencyWords** no GitHub:

- `pt_br_50k.txt`: português brasileiro
- `en_50k.txt`: inglês
- `es_50k.txt`: espanhol

No código, essas fontes ficam em `remoteRhymeWordListUrls`, em `src/hooks/useRealTimeSpeechRecognition.js`.

## O que significa `50k`

`50k` significa que o arquivo contém até cerca de **50.000 palavras/entradas mais frequentes** daquele idioma, ordenadas por frequência de uso no corpus usado pelo projeto.

Cada linha segue este formato:

```text
palavra quantidade_de_ocorrencias
```

Exemplo simplificado:

```text
que 12021478
não 9712854
o 9578625
```

A aplicação usa apenas a primeira coluna, ou seja, a palavra. A segunda coluna é usada indiretamente porque a ordem do arquivo já vem ranqueada por frequência: as palavras mais comuns aparecem primeiro.

## De onde vêm os dados

Segundo o README do projeto FrequencyWords, as listas foram geradas a partir de dados do **OpenSubtitles**:

- listas de 2016: OpenSubtitles2016
- listas de 2018: OpenSubtitles2018

Isso significa que a frequência reflete uso em legendas/diálogos, não necessariamente uma frequência perfeita de literatura, música, poesia ou português formal.

## Isso é uma API?

Não. Atualmente isso **não é uma API de rimas**.

O que usamos é um download direto de arquivos `.txt` hospedados no GitHub Raw. A aplicação faz `fetch()` desses arquivos, lê as linhas e transforma em uma lista de palavras.

Consequências:

- não há endpoint específico de rimas;
- não há busca inteligente por contexto;
- não há garantia de disponibilidade como em uma API comercial;
- a ordenação por relevância vem da frequência do arquivo;
- a rima ainda é calculada pela nossa lógica local, comparando finais das palavras.

## Custo, limite e pagamento

O repositório é público e os arquivos podem ser acessados gratuitamente pelo GitHub Raw.

Mas isso não significa que seja ideal chamar indefinidamente em produção:

- GitHub Raw não é uma API comercial com SLA;
- pode haver rate limit, indisponibilidade ou mudança de URL;
- o projeto externo pode ser alterado, removido ou reorganizado;
- não há plano pago específico desse repositório para garantir disponibilidade.

## Licença

O README do FrequencyWords informa:

- código: MIT License;
- conteúdo/listas: CC BY-SA 4.0.

Se copiarmos as listas para dentro do projeto, precisamos respeitar a licença do conteúdo, incluindo atribuição e compatibilidade da licença CC BY-SA 4.0 para os arquivos derivados.

## Como a aplicação usa essas listas hoje

Fluxo atual:

1. O reconhecimento de voz finaliza uma frase.
2. A aplicação pega a última palavra da frase.
3. Primeiro mostra sugestões locais imediatas.
4. Em paralelo, baixa/carrega as listas de frequência remotas.
5. Filtra entradas inválidas.
6. Procura palavras cujo final combina com a última palavra dita.
7. Como os arquivos estão ordenados por frequência, as primeiras rimas tendem a ser palavras mais comuns.

## Filtros atuais

A aplicação filtra as entradas para aceitar somente palavras simples:

- tudo em minúsculas;
- mais de 2 caracteres;
- apenas letras depois de normalizar acentos;
- sem espaços;
- sem hífen;
- sem nomes próprios capitalizados.

Esse filtro evita casos como frases, termos com hífen e nomes próprios.

## Limitações importantes

Essa solução ainda não entende rima fonética de verdade.

Ela melhora a relevância porque usa frequência de uso, mas ainda depende de comparação textual de finais como `ção`, `ade`, `or`, etc. Isso pode falhar em casos onde a escrita e o som não combinam exatamente, principalmente em inglês e espanhol.

Para uma solução mais robusta, o ideal seria combinar:

1. listas de frequência por idioma;
2. dicionários fonéticos por idioma;
3. regras específicas de pronúncia;
4. filtros de classe gramatical, se quisermos priorizar substantivos, verbos ou adjetivos;
5. cache local para não depender de chamadas externas.

## Próximo passo recomendado

O próximo passo mais seguro é baixar essas listas, versionar localmente no projeto e carregar a partir de arquivos internos.

Isso reduz dependência externa e deixa a aplicação mais previsível. Antes disso, precisamos confirmar e documentar a atribuição/licença CC BY-SA 4.0 dentro do projeto.

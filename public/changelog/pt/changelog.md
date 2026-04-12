# Registro de alterações

## [2.0.0-beta.3] - April 2026

**Resumo:** Sistema de extensões com marketplace, compartilhamento de arquivos em rede local, menu de acesso rápido, arquivos zip, unidades WSL, edição de etiquetas, melhorias na visualização rápida e pesquisa, melhorias nos efeitos visuais e muitas melhorias de UX e estabilidade.

- [Novos recursos](#novos-recursos)
  - [Sistema de extensões](#sistema-de-extensões)
  - [Gerenciador de arquivos padrão](#gerenciador-de-arquivos-padrão)
  - [Compartilhamento em rede local](#compartilhamento-em-rede-local)
  - [Menu de acesso rápido](#menu-de-acesso-rápido)
  - [Arquivos Zip](#arquivos-zip)
  - [Detecção de unidades WSL](#detecção-de-unidades-wsl)
  - [Edição de etiquetas](#edição-de-etiquetas)
  - [Atualizações integradas](#atualizações-integradas)
  - [Copiar caminho](#copiar-caminho)
  - [Fechar abas duplicadas](#fechar-abas-duplicadas)
  - [Menus de contexto Home e Painel](#menus-de-contexto-home-e-painel)
  - [Modo de mesclagem dos efeitos visuais](#modo-de-mesclagem-dos-efeitos-visuais)
- [Novas configurações](#novas-configurações)
- [Novos atalhos](#novos-atalhos)
- [Novos idiomas](#novos-idiomas)
- [Melhorias de UX](#melhorias-de-ux)
  - [Melhorias na visualização rápida](#melhorias-na-visualização-rápida)
  - [Melhorias na pesquisa rápida](#melhorias-na-pesquisa-rápida)
  - [Operações de arquivos](#operações-de-arquivos)
  - [Efeitos visuais](#efeitos-visuais)
- [Melhorias na interface](#melhorias-na-interface)
- [Correções de bugs](#correções-de-bugs)

### Novos recursos

#### Sistema de extensões

Sistema completo de extensões com marketplace aberto.

- **Marketplace**: navegue, instale e gerencie extensões do marketplace;
- **Instalação local**: você pode instalar extensões de uma pasta local;
- **Paleta de comandos**: nova forma de ativar comandos do aplicativo e das extensões;
- **Capacidades**: extensões podem registrar atalhos locais e globais, itens do menu de contexto, configurações, páginas inteiras e comandos;
- **Versionamento**: você pode instalar diferentes versões de extensões e ativar a atualização automática;
- **Localização**: extensões podem fornecer traduções para diferentes idiomas;
- **Gerenciamento de binários**: extensões podem usar binários (ffmpeg, deno, node, yt-dlp, 7z e qualquer outro binário existente);
- **Execução isolada**: extensões são executadas em sandboxes ESM isoladas com permissões granulares;

#### Gerenciador de arquivos padrão

Agora você pode definir o SFM como gerenciador de arquivos padrão no Windows (`Configurações > Experimental`). Quando esta configuração está ativada, a maioria das ações do sistema em arquivos será direcionada para o SFM:

- Ícone do aplicativo Explorador de Arquivos;
- Atalho `Ctrl+E`;
- Revelar arquivo na pasta;
- Mostrar downloads (quando você baixa um arquivo no navegador);
- Comandos do terminal: "start {path}", "code {path}", etc.
- E mais;

Visualizações nativas do sistema como "Lixeira", "Painel de Controle" e outros programas profundamente integrados são delegados ao Explorador de Arquivos nativo.

#### Compartilhamento em rede local

Compartilhe e transmita arquivos e diretórios pela sua rede local diretamente do aplicativo.

Acesse o compartilhamento em rede local pelo botão da barra de ferramentas no navegador ou pelo menu de contexto em qualquer arquivo ou diretório. Quando um compartilhamento está ativo, um código QR e URLs compartilháveis são exibidos. Dois modos estão disponíveis:

- **Transmissão**: transmita arquivos e diretórios para qualquer dispositivo na sua rede via um navegador web;
- **FTP**: compartilhe arquivos via FTP para acesso direto de outros aplicativos. Você pode tanto baixar quanto enviar arquivos de e para o computador a partir de outro dispositivo;

#### Menu de acesso rápido

O botão "Painel" na barra lateral agora funciona como um menu de acesso rápido. Ao passar o mouse sobre ele, um painel se abre mostrando seus Favoritos e itens Etiquetados.

Todos os itens no painel são entradas reais de diretório — você pode arrastar e soltar itens para dentro e para fora, abrir menus de contexto com o clique direito e executar qualquer operação padrão de arquivos.

Pode ser desativado em `Configurações > Aparência da interface > Abrir painel de acesso rápido ao passar o mouse`.

#### Arquivos Zip

Comprima e extraia arquivos zip diretamente do menu de ações do navegador de arquivos:

- **Extrair**: extraia um arquivo `.zip` para o diretório atual ou para uma pasta nomeada;
- **Comprimir**: comprima arquivos e diretórios selecionados em um arquivo `.zip`;

#### Detecção de unidades WSL

No Windows, o aplicativo agora detecta automaticamente as distribuições WSL instaladas e exibe suas unidades no navegador, permitindo que você navegue pelos sistemas de arquivos WSL nativamente.

#### Edição de etiquetas

Agora você pode editar nomes e cores das etiquetas. Abra o seletor de etiquetas em qualquer arquivo ou diretório para renomear etiquetas, alterar sua cor ou excluí-las.

#### Atualizações integradas

Agora você pode baixar e instalar atualizações diretamente da notificação de atualização sem sair do aplicativo.

#### Copiar caminho

Adicionada a opção "Copiar caminho" ao menu de contexto de arquivos e diretórios.

#### Fechar abas duplicadas

Adicionada a capacidade de fechar abas duplicadas na barra de abas, removendo todas as abas que apontam para o mesmo diretório.

#### Menus de contexto Home e Painel

Os itens na página inicial e no painel agora têm menus de contexto completos, correspondendo à funcionalidade disponível no navegador.

### Novas configurações

- **Mostrar banner de mídia da home**: mostrar ou ocultar o banner de mídia da página inicial (`Configurações > Aparência da interface > Banner de mídia da página inicial`);
- **Atraso das dicas**: configurar o atraso antes do aparecimento das dicas (`Configurações > Aparência da interface > Dicas`);
- **Tempo relativo**: exibir timestamps recentes em formato relativo, ex. "5 min atrás" (`Configurações > Geral > Data / hora`);
- **Formato de data e hora**: configurar formato do mês, formato regional, relógio de 12 horas, segundos e milissegundos (`Configurações > Geral > Data / hora`);
- **Desfoque do fundo dos diálogos**: definir a intensidade do desfoque para o fundo dos diálogos (`Configurações > Aparência da interface > Configurações de estilo`);
- **Filtros de brilho e contraste**: ajustar os filtros de estilo de brilho e contraste para a interface do aplicativo (`Configurações > Aparência da interface > Configurações de estilo`);
- **Brilho da mídia de sobreposição**: ajustar o brilho da mídia de sobreposição dos efeitos visuais (`Configurações > Aparência da interface > Efeitos visuais`);
- **Modo de mesclagem dos efeitos visuais**: ajustar o modo de mesclagem para efeitos visuais, permitindo escolher como a mídia de fundo se mescla com a interface do aplicativo (`Configurações > Aparência da interface > Efeitos visuais`);
- **Pausar vídeo de fundo**: pausar o banner da home e o vídeo de fundo quando o aplicativo está inativo ou minimizado (`Configurações > Aparência da interface > Efeitos visuais`);
- **Gerenciador de arquivos padrão**: definir Sigma File Manager como o explorador de arquivos padrão no Windows (`Configurações > Experimental`);
- **Iniciar no login do sistema**: iniciar automaticamente o aplicativo quando você faz login no seu sistema (`Configurações > Geral > Comportamento na inicialização`);

### Novos atalhos

- **Copiar caminho do diretório atual** (`Ctrl+Shift+C`): copiar o caminho do diretório atual para a área de transferência;
- **Recarregar o diretório atual** (`F5`): atualizar a lista de arquivos do navegador;
- **Aumentar / diminuir zoom** (`Ctrl+=` / `Ctrl+-`): aumentar ou diminuir o zoom da interface;
- **Tela cheia** (`F11`): alternar o modo de tela cheia;

### Novos idiomas

- **Hindi**;
- **Urdu**;

### Melhorias de UX

#### Melhorias na visualização rápida

- **Navegação de mídia**: navegue entre os arquivos no diretório atual sem fechar a visualização rápida;
- **Pré-visualização de arquivos de texto**: pré-visualização melhorada de arquivos de texto com detecção correta de codificação, edição em linha e renderização de markdown;

#### Melhorias na pesquisa rápida

- **Todas as propriedades**: pesquise por qualquer propriedade do arquivo — nome, tamanho, contagem de itens, modificado, criado, acessado, caminho ou tipo MIME (ex. `modified: today`, `mime: image`);
- **Intervalos de tamanho**: filtre por tamanho usando comparações e intervalos (ex. `size: >=2mb`, `size: 1mb..10mb`);

#### Operações de arquivos

- **Segurança na resolução de conflitos**: melhorada a segurança dos arquivos na janela de resolução de conflitos para prevenir perda acidental de dados;
- **Colagem de uso único**: itens copiados só podem ser colados uma vez, prevenindo colagens duplicadas acidentais;
- **Copiar texto**: permite copiar texto da interface com `Ctrl+C` quando nenhum arquivo está selecionado;

#### Efeitos visuais

- **Gerenciador de fundo**: adicionado gerenciador de fundo na página de configurações para personalização centralizada do fundo;
- **Redefinição dos efeitos de fundo**: adicionado um botão de redefinição para as configurações de efeitos de fundo;

#### Outro

- **Redução do tamanho do aplicativo**: reduzido o tamanho do pacote do aplicativo excluindo fundos integrados de alta resolução e usando pré-visualizações comprimidas no editor do banner de mídia;
- **Pesquisa global**: exibição de um botão "mostrar configurações" no estado vazio e aumento da profundidade de pesquisa padrão;
- **Atalhos do Windows**: arquivos `.lnk` agora abrem seu destino no navegador em vez de serem executados externamente;
- **Painel**: melhorado o layout da seção de etiquetas;
- **Menu de contexto da barra de endereços**: adicionado menu de contexto aos itens da barra de endereços;
- **Menu de contexto do navegador**: mostrar menu de contexto ao clicar em uma área vazia no navegador;
- **Abrir em nova aba**: abrir diretórios em uma nova aba com o clique do botão do meio do mouse;
- **Rolagem das abas**: novas abas adicionadas rolam automaticamente para ficarem visíveis;
- **Foco dos menus**: os menus não retornam mais o foco para o botão de ativação quando são fechados com um clique externo;
- **Fechar pesquisa**: fechar a pesquisa global com `Escape`;
- **Inicialização mais rápida**: melhoria ligeira na velocidade de inicialização do aplicativo pré-carregando as configurações em Rust;
- **Diretórios do usuário**: adicionada a capacidade de adicionar e remover diretórios do usuário na página inicial;
- **Limites das listas**: diminuídos os limites para entradas frequentes e de histórico para melhorar o desempenho;

### Melhorias na interface

- **Ícones da barra de ferramentas**: cores unificadas dos ícones da barra de ferramentas em todo o aplicativo;
- **Animações dos cartões**: adicionados efeitos de escalonamento e aparecimento gradual aos cartões;
- **Tema claro**: melhoradas as cores e o contraste do tema claro;
- **Estabilidade na inicialização**: melhorada a estabilidade visual durante a inicialização do aplicativo para reduzir a cintilação;
- **Notificações**: melhorado o design das notificações para maior consistência;
- **Rolagem automática das abas**: rolagem automática da aba selecionada para ficar visível ao abrir a página do navegador;
- **Rótulos do caminho raiz**: normalizados os rótulos do caminho raiz nas abas e no painel de informações;
- **Traduções**: melhoradas as traduções em todo o aplicativo;

### Correções de bugs

- Corrigido o congelamento da interface ao copiar ou mover muitos itens; adicionado progresso das operações de arquivos ao centro de estado;
- Corrigido o congelamento da interface ao excluir muitos itens; adicionado progresso da exclusão ao centro de estado;
- Corrigido o menu de contexto na visualização em grade que não abria para o diretório atual quando outro item já tinha um menu aberto;
- Corrigido o painel de informações que não exibia todas as informações do diretório atual;
- Corrigidos os atalhos do aplicativo sendo registrados na janela de visualização rápida em vez de apenas na janela principal;
- Corrigido o tratamento de arquivos arrastados de navegadores web;
- Corrigidos os nomes de arquivos de URLs externos soltos que não mantinham segmentos válidos;
- Corrigido o banner da home sendo arrastável;
- Corrigido o cache de ícones do sistema não sendo indexado por caminho de arquivo, causando ícones incorretos;
- Corrigidas entradas raiz do Windows inacessíveis aparecendo no navegador;
- Corrigidos atalhos personalizados não identificados em alguns layouts de teclado;
- Corrigidas conexões SSHFS no Linux;
- Corrigida a barra de endereços criando entradas duplicadas no histórico ao clicar no breadcrumb;
- Corrigidos os resultados da pesquisa global não respondendo à navegação por teclado;
- Corrigidos os resultados da pesquisa global não abrindo ao clicar;
- Corrigido o status da pesquisa global não sincronizando após a indexação incremental;
- Corrigido o arrastar e soltar de arquivos para fora não funcionando em alguns aplicativos;
- Corrigido o design inconsistente dos emblemas de atalhos em todo o aplicativo;
- Corrigida a visibilidade das colunas do navegador em painéis estreitos;

---

## [2.0.0-beta.2] - February 2026

**Resumo:** Atalhos globais, novas configurações, novos recursos, filtragem de arquivos melhorada, barra de endereços melhorada, melhorias no banner da home e correções de bugs.

### Atalhos globais

Agora você pode usar atalhos de teclado para interagir com o aplicativo mesmo quando ele não está em foco.

Atalhos adicionados:

- `Win+Shift+E` para mostrar e focar a janela do aplicativo;

### Novas configurações

Adicionada configuração para escolher o que acontece quando a última aba é fechada.

![Configuração fechar última aba](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### Novos recursos

Adicionados novos recursos em pré-visualização:

- Locais de rede: permite conectar um local de rede (SSHFS (SSH) / NFS / SMB / CIFS);
- [Linux] Montagem de unidades: permite desmontar locais;

### Filtro de arquivos

O filtro de arquivos foi melhorado:
- Agora quando você muda de diretório, ele limpa e fecha automaticamente;
- O recurso "filtrar ao digitar" é ativado no painel selecionado, não no primeiro;

### Barra de endereços

- Design melhorado e lógica de auto-completar;
- Os divisores do caminho agora são menus suspensos que fornecem navegação rápida para qualquer diretório pai;

![Menus dos divisores](./public/changelog/assets/beta-2/divider-menus.png)

### Banner da home / Efeitos de fundo

- Design melhorado do editor de banner de mídia:
  - O menu de opções do banner de mídia agora abre para baixo para evitar obscurecer a visualização;
  - Agora você pode clicar fora para fechar o editor de posição do fundo;
  - Campo de URL movido acima dos fundos personalizados;
- Imagens/vídeos personalizados podem ser usados nos efeitos visuais de fundo;
- Removidas algumas imagens padrão do banner de mídia;
- Adicionada nova imagem de banner "Exile by Aleksey Hoffman";

### Melhorias de UX

- O aplicativo restaura a posição anterior da janela ao iniciar;
- A aba atual agora pode ser fechada com o atalho `Ctrl+W` ou clique do botão do meio do mouse;
- Aumentado o tamanho dos ícones de arquivos na visualização em grade;

### Correções de bugs

- Corrigido o movimento de arquivos entre abas que às vezes os movia para o local errado;
- Corrigido o navegador que às vezes mostrava ícones de sistema errados para diretórios;
- Corrigida a criação de múltiplas instâncias do aplicativo e da bandeja do sistema;
- Corrigido o menu de extensões shell que buscava dados periodicamente, forçando a lista a rolar para o topo o tempo todo;

## [2.0.0-beta.1] - February 2026

**Resumo:** Grandes melhorias de usabilidade e design incluindo navegação por teclado, novos atalhos, abertura no terminal, atualização automática de diretórios, arrastar e soltar e melhorias na pesquisa e nas visualizações em lista.

### Navegação por teclado

Navegue pelos arquivos usando o teclado com suporte completo para layouts em grade e lista e visualização dividida.

- Teclas de seta para navegação espacial na visualização em grade e navegação sequencial na visualização em lista;
- Enter para abrir o diretório ou arquivo selecionado, Backspace para voltar;
- Ctrl+Esquerda / Ctrl+Direita para alternar o foco entre os painéis da visualização dividida;
- Ctrl+T para abrir o diretório atual em uma nova aba;
- Todos os atalhos de navegação são personalizáveis em Configurações > Atalhos;

### Atualização automática de diretórios

A visualização do navegador atualiza automaticamente quando arquivos são criados, excluídos, renomeados ou modificados no diretório atual.

- Os tamanhos dos arquivos atualizam automaticamente quando alterados por aplicativos externos;
- Monitoramento eficiente do sistema de arquivos com debouncing para evitar atualizações excessivas;
- Atualizações inteligentes baseadas em diferenças que só alteram itens afetados, preservando a posição de rolagem e a seleção;

### Arrastar e soltar

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

Agora você pode arrastar arquivos e pastas para copiá-los/movê-los facilmente. Arraste entre painéis, de ou para listas de resultados de pesquisa, de ou para aplicativos externos.

### Conflitos de cópia

Adicionada janela modal para fácil resolução de conflitos de cópia/movimentação.

### Atualização automática

Adicionada verificação automática de atualizações (pode ser controlada nas configurações).

### Editor de mídia do banner da home

Adicionado editor para personalização do banner da página inicial. Agora você pode enviar imagens e vídeos personalizados (são suportados tanto arquivos locais quanto URLs remotos)

### Melhorias na visualização em lista

- Design melhorado e corrigidos pequenos incômodos;
- Adicionada personalização da visibilidade das colunas: escolha quais colunas exibir;
- Adicionada ordenação por colunas: clique nos cabeçalhos das colunas para ordenar as entradas;
- O layout padrão do navegador foi alterado para visualização em lista;

### Melhorias na pesquisa global

- Layout e design atualizados com suporte para arrastar e soltar;
- A pesquisa agora está disponível enquanto as unidades ainda estão sendo indexadas;

### Abrir no terminal

Abra diretórios no seu terminal preferido diretamente do menu de contexto.

- Detecção automática de terminais instalados no Windows, macOS e Linux;
- O Windows Terminal mostra todos os perfis de shell configurados com ícones dos executáveis;
- O terminal padrão do Linux é auto-detectado e mostrado primeiro;
- Inclui modos normal e administrador/elevado;
- Atalho padrão: Alt+T;

### Localização

- Adicionado idioma esloveno (graças a: @anderlli0053);

### Melhorias de UI / UX

- Adicionado seletor de fontes: escolha a fonte da interface entre as fontes do sistema instaladas;
- Adicionado menu "Criar novo" para criar rapidamente arquivos ou diretórios;
- Exibição de uma visualização de estado vazio ao navegar para diretórios vazios;
- A barra de status mostra o total de itens com contagem oculta quando a lista está filtrada;
- Itens recém-criados, copiados e movidos rolam automaticamente para ficarem visíveis;
- Barra de ferramentas da área de transferência exibida uma vez abaixo dos painéis em vez de em cada painel;
- Design simplificado da janela de renomeação;
- Ícones responsivos da barra de ferramentas que se recolhem em um menu suspenso em janelas pequenas;
- Removida a aba "Navegação" vazia das configurações;
- Renomear um diretório agora atualiza seu caminho em todas as abas, espaços de trabalho, favoritos, etiquetas, histórico e itens frequentes;
- Excluir um arquivo ou diretório agora o remove de todas as listas armazenadas e navega as abas afetadas para a home;
- Caminhos inexistentes nos favoritos, etiquetas, histórico e itens frequentes agora são limpos automaticamente na inicialização;

### Correções de bugs

- Corrigido o status de indexação da pesquisa global não atualizando em tempo real;
- Corrigido o painel da visualização dividida não atualizando quando seu diretório é excluído ou renomeado do outro painel;
- Corrigidas as abas carregando com erro quando seu caminho armazenado não existe mais;
- Corrigidos os ícones do sistema mostrando o mesmo ícone para todos os arquivos do mesmo tipo em vez de ícones únicos por arquivo;
- Corrigidos os atalhos de teclado não funcionando no segundo painel da visualização dividida;
- Corrigidos os atalhos de teclado parando de funcionar após a navegação entre páginas;
- Corrigido vazamento de memória com ouvintes de tecla do filtro não limpos na desmontagem;
- Linux: adicionado suporte para recuperação do aplicativo padrão no menu "abrir com";

---

## [2.0.0-alpha.6] - January 2026

**Resumo:** Janela de Novidades, Visualização rápida, melhorias no menu de contexto e novas configurações.

### Janela de Novidades

Uma janela de registro de alterações que mostra novos recursos e melhorias para cada versão.

- Aparece automaticamente após atualizações (pode ser desativado);
- Navegue por todas as versões;
- Veja descrições detalhadas e capturas de tela para cada recurso;

### Visualização rápida

Pré-visualize arquivos sem abri-los completamente usando uma janela de pré-visualização leve.

- Pressione `Espaço` ou a opção "Visualização rápida" no menu de contexto para visualizar rapidamente os arquivos;
- Feche instantaneamente com `Espaço` ou `Escape`.
- Suporta imagens, vídeos, áudio, arquivos de texto, PDFs e mais;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Cálculo do tamanho dos diretórios

- O tamanho dos diretórios agora é calculado automaticamente;
- Você pode ver o tamanho total de todos os diretórios, incluindo todos os subdiretórios e arquivos, assim que abrir qualquer diretório;

![Abrir com](./public/changelog/assets/alpha-6/size.png)

### Novas opções do menu de contexto

#### Abrir com

- Escolha qual aplicativo usar para abrir um arquivo;
- Configure predefinições personalizadas para abrir arquivos em aplicativos com parâmetros;
- Visualize todos os aplicativos compatíveis para qualquer tipo de arquivo;
- Defina aplicativos padrão para tipos de arquivos específicos;

![Abrir com](./public/changelog/assets/alpha-6/open-with.png)

#### Extensões do shell

- Acesse itens do menu de contexto do shell do Windows;
- Acesse extensões do shell de terceiros (7-Zip, Git, etc.);

![Extensões do shell](./public/changelog/assets/alpha-6/shell-extensions.png)

### Novas configurações

#### Detecção de unidades

- Foca o aplicativo quando dispositivos removíveis são conectados (pode ser desativado);
- Controle o comportamento de abertura automática do Explorador do Windows para unidades removíveis;

#### Filtrar ao digitar

Comece a digitar em qualquer lugar no navegador para filtrar instantaneamente os itens no diretório atual;

#### Atalho de pesquisa nas configurações

Novo atalho de teclado para acesso rápido à pesquisa nas configurações;

#### Dados estatísticos do usuário

- Adicionada seção de configurações de estatísticas;
- Na página do painel você pode ver, navegar, limpar o histórico, favoritos e itens usados com frequência;

### Melhorias na pesquisa

Pesquisa global melhorada com um sistema híbrido indexado + direto para resultados mais confiáveis e atualizados.

- As pesquisas agora levam consistentemente menos de 1 segundo (~1 TB de unidade cheia), não importa onde os arquivos estejam nas suas unidades;
- Quando você pesquisa nos seus "caminhos prioritários" (os que você abre com frequência), obtém resultados instantaneamente e encontra os arquivos mesmo que tenham acabado de ser criados e ainda não tenham sido indexados.

#### Os caminhos prioritários incluem:
- Diretórios do usuário: Downloads, Documentos, Área de Trabalho, Imagens, Vídeos, Música;
- Favoritos;
- Abertos recentemente;
- Usados com frequência;
- Etiquetados;

---

## [2.0.0-alpha.5] - January 2026

**Resumo:** Operações de arquivos, pesquisa global e personalização de atalhos.

### Pesquisa global

Pesquisa poderosa em todo o disco que indexa e pesquisa arquivos em todas as suas unidades. Inclui correspondência aproximada para encontrar arquivos mesmo com erros de digitação, re-indexação automática periódica, indexação prioritária para diretórios usados com frequência e varredura paralela opcional para indexação mais rápida.

![Pesquisa global](./public/changelog/assets/alpha-5/search.png)

### Operações de arquivos

Suporte completo a operações de arquivos com funcionalidades de copiar, mover e excluir incluindo rastreamento de progresso. Inclui também renomeação de arquivos e pastas no local.

### Editor de atalhos

Personalize todos os atalhos de teclado no aplicativo. Visualize as associações atuais, detecte conflitos e restaure os padrões.

### Melhorias no navegador

Adicionada opção para exibir ícones nativos do sistema para arquivos e diretórios em vez de glifos minimalistas. As abas de navegação das configurações agora ficam fixas no topo da página durante a rolagem.

---

## [2.0.0-alpha.4] - January 2026

**Resumo:** Página inicial, efeitos visuais e opções de personalização do usuário.

### Página inicial

Uma bela página inicial com um banner de mídia animado, lista de unidades e acesso rápido a diretórios comuns do usuário como Documentos, Downloads, Imagens e mais.

### Efeitos visuais

Seção de efeitos visuais personalizáveis nas configurações que adiciona desfoque, opacidade e efeitos de ruído ao fundo do aplicativo. Suporta configurações diferentes para cada página.

### Editor de diretórios do usuário

Personalize seus cartões de diretórios do usuário com títulos, ícones e caminhos personalizados. Personalize a aparência dos seus diretórios de acesso rápido na página inicial.

### Editor de posição do banner

Ajuste com precisão a posição dos fundos do banner da página inicial. Ajuste zoom, posicionamento horizontal e vertical para o visual perfeito.

### Melhorias nas configurações

- A pesquisa nas configurações agora funciona em qualquer idioma, não apenas no atual;
- O aplicativo restaura a última aba de configurações visitada ao recarregar em vez de abrir a primeira toda vez;

---

## [2.0.0-alpha.3] - December 2025

**Resumo:** Visualização do navegador com abas, espaços de trabalho e um novo sistema de design.

### Visualização do navegador

A experiência principal de navegação de arquivos com um sistema moderno de abas com suporte a espaços de trabalho, um novo design da barra de ferramentas da janela com controles integrados e navegação de painel duplo para gerenciamento eficiente de arquivos.

### Miniaturas de vídeo

Adicionadas miniaturas de pré-visualização para arquivos de vídeo no navegador.

### Migração do sistema de design

Migração do aplicativo de Vuetify para Sigma-UI para um design mais espaçoso e moderno com melhor qualidade de código.

---

## [2.0.0-alpha.1] - January 2024

**Resumo:** Reescrita completa usando tecnologias modernas.

### Migração Tauri

Sigma File Manager v2 foi reconstruído do zero usando Vue 3 Composition API, TypeScript e Tauri v2. O tamanho de instalação do aplicativo foi reduzido de 153 MB para apenas 4 MB no Windows. O tamanho do aplicativo instalado foi reduzido de 419 MB para 12 MB.

### Painéis redimensionáveis

Adicionado recurso de painéis redimensionáveis que permite dividir a visualização do navegador ao meio e trabalhar com 2 diretórios lado a lado.

### Recursos iniciais

Navegação básica de arquivos com listagem de diretórios, gerenciamento de janela com controles de minimizar, maximizar e fechar, e uma estrutura inicial da página de configurações.

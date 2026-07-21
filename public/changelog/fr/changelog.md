# Journal des modifications

## [2.2.0] - July 2026

**Résumé :** Intégration du presse-papiers système aux autres applications, sélection par cadre, vue fractionnée liée, gestion des liens, archives ZIP protégées par mot de passe, propriétés natives sous Windows, enrichissement de l'API des extensions, prise en charge de l'hébreu et améliorations du navigateur.

- [Nouvelles fonctionnalités](#nouvelles-fonctionnalités)
  - [Intégration du presse-papiers système](#intégration-du-presse-papiers-système)
  - [Sélection par cadre](#sélection-par-cadre)
  - [Vue fractionnée liée](#vue-fractionnée-liée)
  - [Gestion des liens](#gestion-des-liens)
  - [Fenêtre Propriétés native](#fenêtre-propriétés-native)
  - [Redimensionnement et réorganisation des colonnes de la vue liste](#redimensionnement-et-réorganisation-des-colonnes-de-la-vue-liste)
  - [Adresse racine « Emplacements »](#adresse-racine-emplacements)
- [Extensions](#extensions)
  - [API et vues des extensions](#api-et-vues-des-extensions)
- [Nouveaux paramètres](#nouveaux-paramètres)
- [Nouveaux raccourcis](#nouveaux-raccourcis)
- [Nouvelles langues](#nouvelles-langues)
- [Améliorations UX](#améliorations-ux)
  - [Extraction d'archives](#extraction-darchives)
  - [Tri de la grille](#tri-de-la-grille)
  - [Extensions shell](#extensions-shell)
  - [Mémoire de session](#mémoire-de-session)
  - [Performances du navigateur](#performances-du-navigateur)
  - [Page d'accueil et menus contextuels](#page-daccueil-et-menus-contextuels)
- [Améliorations de l'interface](#améliorations-de-linterface)
- [Corrections de bugs](#corrections-de-bugs)

### Nouvelles fonctionnalités

#### Intégration du presse-papiers système

Vous pouvez désormais copier et coller des fichiers, des dossiers et des images entre Sigma File Manager et d'autres applications à l'aide du presse-papiers système.

- **Transfert de fichiers entre applications** : copiez ou coupez des éléments dans SFM et collez-les dans des applications comme l'Explorateur de fichiers, ou collez des chemins et fichiers copiés depuis d'autres applications dans le navigateur avec `Ctrl+V` ;
- **Collage d'images** : collez des images copiées depuis des navigateurs et d'autres applications directement dans un dossier ;
- **Dialogues de conflit** : lorsque les éléments collés existent déjà, choisissez `Renommer` ou `Fusionner`, et résolvez les conflits individuels avec Remplacer, Ignorer, Conserver les deux ou Appliquer à tous ;
- **Barre d'outils du presse-papiers** : aperçu facultatif, dans la barre d'outils, des images et chemins de fichiers copiés dans d'autres applications ;

Vous pouvez afficher ou masquer la barre d'outils dans `Paramètres > Apparence de l'interface > Presse-papiers`. Le collage avec `Ctrl+V` reste possible lorsqu'elle est masquée.

![system-clipboard](./public/changelog/assets/2.2.0/system-clipboard.webp)

#### Sélection par cadre

Faites glisser le pointeur sur un espace vide du navigateur pour sélectionner plusieurs éléments à l'aide d'un cadre de sélection.

- **Touches de modification** : maintenez `Ctrl` ou `Shift` pour ajouter des éléments à la sélection actuelle ; maintenez `Alt` pour l'inverser ;
- **Sélection facilitée** : augmentez éventuellement l'espacement des listes et des grilles afin de disposer de plus de place pour commencer le glissement ;

Activez cette fonction dans `Paramètres > Général > Vue des fichiers > Activer la sélection par cadre`.

![box-selection](./public/changelog/assets/2.2.0/box-selection.webp)

#### Vue fractionnée liée

Le nouveau mode de vue fractionnée `Liée` simplifie les flux de travail en colonnes : un clic sur un dossier dans le premier volet affiche son contenu dans le second.

Le mode indépendant `Fractionnée` existant reste inchangé. Sélectionnez le mode dans le menu d'options du navigateur, sous `Mode de vue fractionnée`, ou affichez et masquez la vue fractionnée avec `Ctrl+S`.

L'icône du panneau d'informations a également été mise à jour pour la distinguer plus facilement de l'icône de la vue fractionnée.

![linked-split-view](./public/changelog/assets/2.2.0/linked-split-view.webp)

#### Gestion des liens

Créez et inspectez des liens du système de fichiers depuis le navigateur.

- **Créer un lien** : créez des liens symboliques, des raccourcis, des liens physiques et des jonctions depuis le menu contextuel (`Créer un lien`) ;
- **Colonnes de lien** : colonnes de liste optionnelles pour Type, Liens, Cible du lien et État du lien (`Valide`, `Rompu`, `Inconnu`, `Non pris en charge`) ;
- **Comportement à l'ouverture** : les raccourcis de répertoire et les dossiers de liens symboliques donnent accès à leur cible ; les autres cibles de lien s'ouvrent avec l'application par défaut ;

![link-handling](./public/changelog/assets/2.2.0/link-handling.webp)

#### Fenêtre Propriétés native

Sous Windows, ouvrez la boîte de dialogue système native `Propriétés` pour les éléments sélectionnés depuis le menu contextuel, le menu d'actions, `Alt+Enter` ou `Alt` + double-clic.

![native-properties](./public/changelog/assets/2.2.0/native-properties.webp)

#### Redimensionnement et réorganisation des colonnes de la vue liste

Les colonnes de la vue liste peuvent être redimensionnées et réorganisées selon vos besoins.

- **Redimensionner** : faites glisser les bords des colonnes pour modifier les largeurs ;
- **Ordre et visibilité** : gérez l'ordre et la visibilité depuis le menu `Colonnes` de l'en-tête de la liste ;
- **Options de largeur** : `Remplir la largeur disponible` et `Définir les largeurs minimales` ;

![list-column-resize](./public/changelog/assets/2.2.0/list-column-resize.webp)

#### Adresse racine « Emplacements »

L'adresse racine `Emplacements` permet d'accéder rapidement aux lecteurs et aux emplacements virtuels.

- **Barre d'adresse** : remontez d'un niveau depuis la racine d'un lecteur ou ouvrez `Emplacements` depuis la barre d'adresse ou l'éditeur d'adresse ;
- **Favoris et étiquettes** : les emplacements peuvent être ajoutés aux favoris et recevoir des étiquettes comme les autres répertoires ;
- **Vue fractionnée** : particulièrement utile pour changer de lecteur entre les volets sans quitter le navigateur ;

![root-locations-address](./public/changelog/assets/2.2.0/root-locations-address.webp)

### Extensions

#### API et vues des extensions

Les extensions bénéficient de fonctionnalités supplémentaires offertes par l'hôte et de nouveaux composants d'interface.

- **Binaires locaux** : configurez les dépendances des extensions avec une installation automatique ou en sélectionnant manuellement des binaires locaux (`Extensions > Dépendances`) ;
- **Requêtes HTTP** : les extensions peuvent effectuer des requêtes HTTP vers les hôtes autorisés par leur manifeste ;
- **Contrôle de la vue** : les extensions peuvent appliquer les préférences de disposition et de tri du navigateur (avec l'autorisation d'accès à la vue) ;
- **API du presse-papiers** : les extensions peuvent lire et écrire dans le presse-papiers (avec autorisation) ;
- **Vue liste-détail** : nouveau modèle d'interface pour les extensions, avec une liste dotée d'une fonction de recherche et un volet de détail ;

![extension-local-binaries](./public/changelog/assets/2.2.0/extension-local-binaries.webp)

![extension-dependency-config](./public/changelog/assets/2.2.0/extension-dependency-config.webp)

![extension-list-detail](./public/changelog/assets/2.2.0/extension-list-detail.webp)

![extension-http-api](./public/changelog/assets/2.2.0/extension-http-api.webp)

### Nouveaux paramètres

- **Activer la sélection par cadre** : faire glisser le pointeur depuis un espace vide pour sélectionner plusieurs éléments ;
  `Paramètres > Général > Vue des fichiers > Activer la sélection par cadre`
- **Augmenter les espacements de la vue des fichiers** : augmenter l'espacement des listes et des grilles pour faciliter la sélection ;
  `Paramètres > Général > Vue des fichiers > Augmenter les espacements de la vue des fichiers`
- **Garder la fenêtre Aperçu rapide en mémoire** : conserver l'Aperçu rapide en mémoire pour qu'il s'ouvre instantanément (utilise environ 200 Mo) ;
  `Paramètres > Général > Performances > Garder la fenêtre Aperçu rapide en mémoire`
- **Garder la fenêtre Impression en mémoire** : conserver la fenêtre Impression en mémoire pour qu'elle s'ouvre instantanément (utilise environ 200 Mo) ;
  `Paramètres > Général > Performances > Garder la fenêtre Impression en mémoire`
- **Barre d'outils du presse-papiers pour les images externes** : afficher la barre d'outils du presse-papiers pour les images copiées dans d'autres applications ;
  `Paramètres > Apparence de l'interface > Presse-papiers`
- **Barre d'outils du presse-papiers pour les chemins externes** : afficher la barre d'outils du presse-papiers pour les chemins de fichiers copiés dans d'autres applications ;
  `Paramètres > Apparence de l'interface > Presse-papiers`
- **Taille dynamique du panneau d'informations** : laisser la taille du panneau d'informations s'adapter ou désactiver cette fonction en le redimensionnant manuellement ;
  `Paramètres > Apparence de l'interface > Panneau d'informations > Taille dynamique du panneau d'informations`
- **Afficher l'image en taille réelle dans l'aperçu du panneau d'informations** : afficher les images en pleine résolution dans le panneau d'informations ;
  `Paramètres > Apparence de l'interface > Panneau d'informations > Afficher l'image en taille réelle dans l'aperçu du panneau d'informations`
- **Couper le son de l'aperçu vidéo par défaut** : couper le son des aperçus vidéo du panneau d'informations lors de la navigation ;
  `Paramètres > Apparence de l'interface > Panneau d'informations > Couper le son de l'aperçu vidéo par défaut`
- **Lire automatiquement les aperçus vidéo** : lire automatiquement les vidéos dans le panneau d'informations lorsqu'elles sont sélectionnées ;
  `Paramètres > Apparence de l'interface > Panneau d'informations > Lire automatiquement les aperçus vidéo`

### Nouveaux raccourcis

- **Propriétés natives** (`Alt+Enter`) : ouvrir la fenêtre Propriétés native pour les éléments sélectionnés sous Windows ;

### Nouvelles langues

- **Hébreu** (`עברית`) : traduction complète avec prise en charge de la disposition de droite à gauche (`Paramètres > Général > Langue`) ;

### Améliorations UX

#### Extraction d'archives

L'extraction ZIP prend désormais en charge les archives chiffrées et les noms de fichiers utilisant un encodage autre que UTF-8.

- **Archives ZIP protégées par mot de passe** : saisissez le mot de passe de l'archive lorsque l'extraction le demande ;
- **Encodage des noms de fichiers** : choisissez l'encodage dans `Options d'extraction d'archives` ; la détection automatique est privilégiée et les encodages régionaux regroupés servent de solutions de repli ;

![archive-extraction-options](./public/changelog/assets/2.2.0/archive-extraction-options.webp)

![archive-extraction-encoding](./public/changelog/assets/2.2.0/archive-extraction-encoding.webp)

#### Tri de la grille

La disposition en grille dispose désormais de ses propres options de tri dans le menu d'options du navigateur.

- **Trier par** : Nom, Éléments, Taille, Modifié, Créé, Étiquettes, Type, Liens et État du lien ;
- **Direction** : croissante ou décroissante, enregistrée séparément du tri de la vue liste ;

![grid-sorting](./public/changelog/assets/2.2.0/grid-sorting.webp)

#### Extensions shell

Le menu contextuel peut charger les actions d'extensions shell modernes enregistrées par d'autres applications sous `Extensions shell`.

![shell-extensions](./public/changelog/assets/2.2.0/shell-extensions.webp)

#### Mémoire de session

Les positions de défilement et les onglets actifs sont restaurés lorsque vous quittez une page ou un volet et y revenez pendant la même session.

#### Performances du navigateur

La navigation dans les grands dossiers et les médias est plus rapide et utilise moins de mémoire.

- **Premier chargement** : les répertoires se chargent plus rapidement lors de leur première ouverture ;
- **Chargement des icônes** : les icônes personnalisées et système s'affichent plus rapidement ;
- **Défilement dans les listes** : défilement plus fluide dans les grands répertoires ;
- **Aperçus multimédias** : les aperçus d'images, GIF et vidéos sont plus réactifs et utilisent moins de mémoire ;
- **Indexation** : indexation de la recherche globale plus stable ;

#### Page d'accueil et menus contextuels

- **Déconnecter** : déconnectez les partages réseau ou les supports amovibles depuis le menu contextuel lorsque cette fonction est prise en charge ;
- **Fermer tous les doublons** : le menu d'onglets `Fermer tous les doublons` ferme désormais tous les chemins ouverts en double dans l'espace de travail, et pas seulement les doublons de l'onglet actuel ;
- **Annulation de la sélection par clic droit** : un clic droit sur l'arrière-plan vide du navigateur annule la sélection active avant d'ouvrir le menu contextuel de l'arrière-plan ;
- **Actions de l'accueil** : les menus contextuels de la page d'accueil se ferment après l'exécution d'une action, `Ouvrir dans un nouvel onglet` ouvre le navigateur et la barre d'onglets défile automatiquement jusqu'aux nouveaux onglets ;
- **Zone de glissement de la fenêtre** : sur les barres de titre de type Linux, la zone de glissement recouvre les boutons de la barre d'outils afin de faciliter le déplacement de la fenêtre ;

![window-drag-region](./public/changelog/assets/2.2.0/window-drag-region.webp)

### Améliorations de l'interface

- **Indicateur de volet actif** : marqueur plus clair du volet actif dans la barre d'état lorsque la vue fractionnée est activée ;
- **Panneau d'informations redimensionnable** : faites glisser les séparateurs pour modifier la largeur du panneau d'informations et la répartition entre aperçu et détails ;
- **Panneau d'informations compact** : disposition des propriétés plus dense dans le panneau d'informations ;
- **Actions du menu contextuel** : `Modifier la carte` s'affiche sous forme de bouton d'action et tous les boutons d'action sont globalement plus petits ;
- **Style du navigateur** : disposition adaptative améliorée, onglets actifs mieux mis en évidence dans la vue fractionnée et vue des extensions remaniée dans la palette de commandes ;
- **Disposition RTL** : alignement plus propre pour les langues de droite à gauche ;

![resizable-info-panel](./public/changelog/assets/2.2.0/resizable-info-panel.webp)

![compact-info-panel](./public/changelog/assets/2.2.0/compact-info-panel.webp)

### Corrections de bugs

- **Taper pour rechercher** : la recherche rapide s'active désormais avec les dispositions de clavier non latines ;
- **Chargement des répertoires** : les entrées ne changent plus d'ordre à la fin du chargement d'un répertoire ;
- **Icônes personnalisées** : les icônes personnalisées ne s'affichent plus avec un retard perceptible ;
- **Cartes de grille** : les cartes de la disposition en grille ne changent plus de taille pendant le chargement ;
- **Barre de défilement de la grille** : la barre de défilement de la grille ne se cache plus derrière les en-têtes fixes ;
- **Sélection rapide** : la sélection rapide de fichiers n'ouvre plus de fichier par inadvertance ;
- **Raccourci terminal** : `Alt+T` ouvre désormais un terminal pour l'entrée sélectionnée, et non pour le répertoire courant ;
- **Ouverture de fichiers** : les fichiers s'ouvrent désormais depuis le bon répertoire de travail ;
- **Partages SMB** : les fichiers des partages SMB peuvent de nouveau être ouverts ;
- **Chemins WSL** : la gestion des chemins UNC de l'hôte WSL sous Windows a été corrigée, y compris celle de `//wsl.localhost` comme liste virtuelle de distributions ;
- **Gestionnaire de fichiers par défaut** : le réglage reste disponible pour les installations Windows directes ; la version Microsoft Store l'affiche désormais comme indisponible ;
- **AppImage (Linux)** : l'erreur `Could not create default EGL display: EGL_BAD_PARAMETER` a été corrigée ;
- **Installation d'extensions (Linux)** : les échecs d'installation des extensions contenant plusieurs fichiers dans leur répertoire `dist` ont été corrigés ;
- **Détails d'extension** : l'alignement de la page de présentation a été corrigé ;
- **Réveil de l'appareil** : l'application ne reste plus bloquée en cours de chargement après le réveil de l'appareil ;
- **Notifications de mise à jour** : les notifications de mise à jour ne s'affichent plus pour les versions non publiées ;
- **RTL** : les problèmes de disposition de droite à gauche ont été corrigés ;
- **Traductions** : les chaînes de traduction manquantes ou incorrectes ont été corrigées ;

---

## [2.1.0] - May 2026

**Résumé :** Améliorations des performances du navigateur, miniatures générées, thèmes d'extensions, impression, aperçus de fichiers, nouveaux raccourcis, améliorations de l'éditeur d'adresse, refonte du centre d'état et ajustements des onglets et de la navigation.

- [Nouvelles fonctionnalités](#nouvelles-fonctionnalités)
  - [Impression](#impression)
  - [Déposer des fichiers sur les onglets](#déposer-des-fichiers-sur-les-onglets)
  - [Aperçu de fichiers dans le panneau d'informations](#aperçu-de-fichiers-dans-le-panneau-dinformations)
  - [Colonnes de liste du navigateur](#colonnes-de-liste-du-navigateur)
- [Extensions](#extensions)
  - [Thèmes d'application depuis les extensions](#thèmes-dapplication-depuis-les-extensions)
  - [Thèmes d'icônes depuis les extensions](#thèmes-dicônes-depuis-les-extensions)
- [Nouveaux paramètres](#nouveaux-paramètres)
- [Nouveaux raccourcis](#nouveaux-raccourcis)
- [Améliorations UX](#améliorations-ux)
  - [Performances des grands répertoires](#performances-des-grands-répertoires)
  - [Recherche rapide](#recherche-rapide)
  - [Éditeur d'adresse](#éditeur-dadresse)
  - [Centre d'état](#centre-détat)
  - [Navigation et onglets](#navigation-et-onglets)
  - [Gestion des raccourcis](#gestion-des-raccourcis)
- [Améliorations de l'interface](#améliorations-de-linterface)
- [Corrections de bugs](#corrections-de-bugs)

### Nouvelles fonctionnalités

#### Impression

Les fichiers sélectionnés peuvent être imprimés directement depuis le navigateur à l'aide du menu contextuel, du menu d'actions ou de `Ctrl+O`.

- **Formats pris en charge** : images, PDF, formats texte ;
- **Fermeture rapide** : fermez la vue d'impression avec `Escape` ;

![printing](./public/changelog/assets/2.1.0/printing.webp)

#### Déposer des fichiers sur les onglets

Faites glisser des fichiers ou répertoires sur les onglets pour les déplacer ou les copier dans le répertoire d'un autre onglet.

- **Onglets comme cibles de dépôt** : les onglets deviennent des cibles de dépôt lors du glissement de fichiers dans le navigateur ;
- **Activation au survol** : le survol d'un onglet pendant le glissement permet de basculer vers cet onglet avant le dépôt ;
- **Onglets fractionnés** : les groupes d'onglets de répertoire conservent leur comportement de dépôt normal ainsi que la structure des onglets en vue fractionnée ;

![file-drop-to-tabs](./public/changelog/assets/2.1.0/file-drop-to-tabs.webp)

#### Aperçu de fichiers dans le panneau d'informations

Le panneau d'informations peut désormais afficher un aperçu de tous les types de fichiers pris en charge par l'Aperçu rapide, et plus seulement des images et des vidéos.

- **Aperçus média** : les images utilisent des miniatures générées, les vidéos et les fichiers audio disposent de commandes natives et les PDF s'affichent directement dans le panneau ;
- **Aperçus texte** : les fichiers texte affichent un aperçu décodé compact avec une limite de taille raisonnable ;
- **Solutions de repli** : les fichiers et dossiers non pris en charge conservent une simple icône générique ;

![info-panel-file-preview](./public/changelog/assets/2.1.0/info-panel-file-preview.webp)

#### Colonnes de liste du navigateur

La vue liste offre davantage de colonnes facultatives et permet de gérer plus facilement les métadonnées directement dans la liste.

- **Colonne `Créé`** : afficher la date de création et trier les éléments selon celle-ci ;
- **Colonne `Étiquettes`** : afficher les étiquettes directement dans la vue liste et les ajouter, les supprimer ou les modifier depuis cette colonne ;

![navigator-list-columns](./public/changelog/assets/2.1.0/navigator-list-columns.webp)

### Extensions

#### Thèmes d'application depuis les extensions

Les extensions peuvent désormais proposer des thèmes de couleurs complets pour l'application. Les extensions de thème installées apparaissent dans le sélecteur de thèmes.

#### Thèmes d'icônes depuis les extensions

Les extensions peuvent désormais proposer des thèmes d'icônes pour les dossiers et les fichiers du navigateur.

- **Choix séparés** : choisissez séparément les thèmes d'icônes des dossiers et des fichiers dans `Paramètres > Apparence de l'interface > Thème d'icônes` ;
- **Thèmes intégrés et d'extensions** : utilisez les thèmes d'icônes par défaut ou système intégrés, ou tout thème fourni par une extension activée ;
- **Règles d'association** : les thèmes fournis peuvent définir des icônes selon l'extension ou le nom du fichier, le nom du dossier et l'état ouvert ou fermé du dossier ;

### Nouveaux paramètres

- **Texte en gras de l'onglet actif** : mettre le titre de l'onglet actif en gras (`Paramètres > Onglets > Apparence des onglets > Texte en gras de l'onglet actif`) ;

![bold-active-tab-text-setting](./public/changelog/assets/2.1.0/bold-active-tab-text-setting.webp)

### Nouveaux raccourcis

- **Basculer la vue fractionnée** (`Ctrl+S`) : afficher ou masquer la vue fractionnée dans le navigateur ;
- **Restaurer l'onglet fermé** (`Ctrl+Shift+T`) : restaurer le dernier groupe d'onglets fermé ;
- **Créer un fichier / répertoire** (`Ctrl+Shift+M` / `Ctrl+Shift+N`) : créer un nouveau fichier ou répertoire dans le répertoire courant ;
- **Imprimer le fichier sélectionné** (`Ctrl+O`) : imprimer le fichier sélectionné ;
- **Ouvrir le chemin copié** (`Ctrl+Shift+V`) : ouvrir un chemin valide depuis le presse-papiers ;
- **Passer d'une page à l'autre** (`Alt+1` - `Alt+5`) : basculer entre Accueil, Navigateur, Tableau de bord, Paramètres et Extensions ;
- **Parcourir l'historique des répertoires** (`Alt+Left` / `Alt+Right`) : revenir en arrière ou avancer dans l'historique du navigateur ;
- **Aller au répertoire parent** (`Alt+Up`) : aller au répertoire parent ;
- **Boutons latéraux de la souris** (`Mouse Button 4` / `Mouse Button 5`) : naviguer en arrière et en avant avec les boutons latéraux de la souris ;

![create-file-directory-shortcuts](./public/changelog/assets/2.1.0/create-file-directory-shortcuts.webp)

![navigator-shortcuts](./public/changelog/assets/2.1.0/navigator-shortcuts.webp)

### Améliorations UX

#### Performances des grands répertoires

La navigation, la recherche rapide et les dossiers contenant beaucoup de médias sont plus réactifs et utilisent moins de mémoire.

- **Miniatures générées** : les miniatures d'images et de vidéos sont générées dans des dimensions réduites au lieu de charger le fichier multimédia complet dans chaque carte ;
- **Images progressives** : les cartes d'images de la grille peuvent afficher une miniature floue en basse résolution avant que la miniature finale soit prête ;
- **Annulation de la génération** : la génération de miniatures peut être annulée lorsque le dossier ou les entrées visibles changent ;
- **Performances de rendu** : dans les grands répertoires, les entrées sont rendues plus efficacement et l'Aperçu rapide utilise des miniatures générées dans une liste virtuelle ;

![low-res-image-thumbnail-preview](./public/changelog/assets/2.1.0/low-res-image-thumbnail-preview.webp)

#### Recherche rapide

La recherche rapide dispose maintenant de deux modes : passif et actif :

- **Mode passif** : il s'active automatiquement lorsque vous commencez à taper, filtre les entrées sans placer le curseur dans le champ de recherche et n'empêche pas la navigation ;
- **Mode actif** : il s'active avec `Ctrl+F`, place le curseur dans le champ de recherche et empêche la navigation, mais permet de contrôler plus précisément la requête saisie ;

Autres changements :

- **Taper pour filtrer** : la saisie de caractères alphanumériques démarre toujours la recherche rapide (mode passif) dans le volet actif ;
- **Navigation au clavier** : le premier élément correspondant est sélectionné automatiquement ;
- **Fenêtre contextuelle** : la fenêtre contextuelle de recherche rapide est plus compacte et évite de masquer les éléments du répertoire ;

![quick-search](./public/changelog/assets/2.1.0/quick-search.webp)

#### Éditeur d'adresse

L'éditeur d'adresse permet désormais d'ouvrir davantage de types de chemins.

- **Fichiers et répertoires** : ouvrez des fichiers ainsi que des répertoires depuis l'éditeur d'adresse ;
- **Chemins fréquents** : basculez vers un mode conçu pour ouvrir rapidement les chemins fréquemment utilisés ;
- **Suggestions** : accédez aux entrées de répertoire, aux correspondances exactes, aux chemins récents, aux éléments étiquetés, aux dossiers utilisateur et aux lecteurs système ;
- **Actions au clavier** : naviguez en arrière, en avant ou vers le haut, et affichez une entrée dans son répertoire parent depuis l'éditeur ;

![address-editor](./public/changelog/assets/2.1.0/address-editor.webp)

#### Centre d'état

Le centre d'état prend désormais la forme d'un widget compact dans la barre d'outils, avec des groupes d'opérations plus clairs.

- **Compteur actif** : le bouton de la barre d'outils s'étend pour former un badge affichant le nombre d'opérations actives ;
- **Groupes d'opérations** : les opérations actives et terminées sont séparées, les opérations terminées étant regroupées dans une section repliable ;
- **Tout annuler** : les opérations actives peuvent être annulées simultanément depuis l'en-tête de la section ;
- **Fiches d'opération** : les fiches d'opération affichent des libellés de type et d'état plus clairs, tels que `Copier | Succès` ou `Archive | Erreur` ;
- **Récupération du presse-papiers** : lors d'un collage, le presse-papiers est vidé dès qu'une tâche est mise en file d'attente, puis restauré si la tâche échoue ;

![status-center](./public/changelog/assets/2.1.0/status-center.webp)

#### Navigation et onglets

La navigation et le comportement des onglets sont plus prévisibles.

- **Lecteurs de la barre latérale** : un clic sur un lecteur dans la barre latérale de navigation l'ouvre dans l'onglet actuel ;
- **Répertoire courant** : le segment correspondant au répertoire courant est mieux mis en évidence et son menu contextuel s'ouvre par un clic droit sur le dernier segment de l'adresse ;
- **Onglets fermés** : les onglets restaurés reprennent leur position précédente, conservent les chemins renommés et redirigent les chemins supprimés vers l'accueil ;
- **Disposition adaptative** : les boutons de navigation de la barre d'outils se replient plus tôt, les barres d'adresse de la vue fractionnée passent sur une deuxième ligne dans les volets très étroits et les onglets compacts conservent une hauteur uniforme ;

![nav-sidebar-drive-current-tab](./public/changelog/assets/2.1.0/nav-sidebar-drive-current-tab.webp)

![current-directory-address-bar](./public/changelog/assets/2.1.0/current-directory-address-bar.webp)

#### Gestion des raccourcis

L'éditeur de raccourcis gère désormais plus clairement les conflits et la personnalisation.

- **Affectations multiples** : associez plusieurs raccourcis à une même action ;
- **Retrait des raccourcis** : retirez l'affectation d'un raccourci ;
- **Résolution des conflits** : remplacez un raccourci en conflit directement depuis le message signalant le conflit ;
- **Menu de la liste des raccourcis** : gérez les raccourcis depuis un menu contextuel dans la liste des raccourcis ;

![shortcut-editor](./public/changelog/assets/2.1.0/shortcut-editor.webp)

#### Glisser-déposer

Il est désormais possible de changer d'application avec `Alt+Tab` pendant un glissement. Les fichiers peuvent ainsi être glissés hors de Sigma File Manager sans que le pointeur ait à quitter la fenêtre ;

### Améliorations de l'interface

- **Anneau de sélection** : opacité et décalage de l'anneau de sélection, style de l'en-tête des volets et comportement du focus clavier améliorés ;
- **Barre d'onglets** : apparence de la barre d'onglets et lisibilité de l'onglet actif améliorées ;
- **Sélection de thème** : présentation du sélecteur de thème améliorée ;
- **Accès rapide** : style du panneau d'accès rapide affiné ;
- **Écran de démarrage** : ajout d'un écran de démarrage de l'application au lancement ;
- **Visibilité des fenêtres contextuelles** : visibilité améliorée des éléments translucides dans les fenêtres contextuelles ;
- **Info-bulles** : ajout d'info-bulles à davantage de boutons de la barre d'outils ;
- **Traductions** : textes japonais et vietnamiens améliorés et organisation des fichiers de langue simplifiée ;

![selection-ring](./public/changelog/assets/2.1.0/selection-ring.webp)

![tab-bar-styles](./public/changelog/assets/2.1.0/tab-bar-styles.webp)

![narrow-window-layout](./public/changelog/assets/2.1.0/narrow-window-layout.webp)

### Corrections de bugs

- **Lecteurs mappés** : le glisser-déposer sortant fonctionne de nouveau depuis les lecteurs réseau mappés ;
- **Défilement au clavier** : la première ligne n'est plus masquée par l'en-tête fixe ;
- **Gel au démarrage** : les rares gels de plusieurs minutes au démarrage sous Windows, causés par des appels système synchrones lents pendant le lancement et la recherche de mises à jour, ont été corrigés ;
- **Extraction d'archives** : les modes de fichiers Unix sont désormais conservés lors de l'extraction d'archives ;
- **HTTP des extensions** : la gestion des réponses non 2xx considérées comme définitives a été rétablie et les délais avant une nouvelle tentative peuvent désormais être annulés ;
- **Palette de commandes** : le bouton de la palette de commandes dans la barre d'outils fonctionne désormais lorsque son raccourci est personnalisé ;
- **Sélection par plage en grille** : la sélection par plage en vue grille ne sélectionne plus d'entrées hors de la plage visée ;
- **Menus contextuels** : les menus contextuels de l'élément sélectionné et du répertoire courant se ferment désormais après un clic sur une action ;
- **Enregistrement des raccourcis** : les erreurs d'enregistrement des raccourcis après le rechargement de la fenêtre ont été corrigées ;
- **Application des thèmes** : les thèmes sélectionnés s'appliquent désormais dans toutes les fenêtres ;
- **Déplacements sous macOS** : la gestion des déplacements entre volumes sous macOS a été corrigée et les cibles de bundles ont été activées ;
- **Gestionnaire de fichiers par défaut** : les valeurs précédentes du registre Windows sont désormais restaurées de manière plus sûre si l'activation du gestionnaire de fichiers par défaut échoue ;

![keyboard-scroll-floating-header](./public/changelog/assets/2.1.0/keyboard-scroll-floating-header.webp)

---
## [2.0.0-beta.3] - April 2026

**Résumé :** Système d'extensions avec marketplace, partage de fichiers en réseau local, menu d'accès rapide, archives zip, lecteurs WSL, édition des étiquettes, amélioration de l'aperçu rapide et de la recherche, améliorations des effets visuels, et de nombreuses améliorations UX et de stabilité.

- [Nouvelles fonctionnalités](#nouvelles-fonctionnalités)
  - [Système d'extensions](#système-dextensions)
  - [Gestionnaire de fichiers par défaut](#gestionnaire-de-fichiers-par-défaut)
  - [Partage en réseau local](#partage-en-réseau-local)
  - [Menu d'accès rapide](#menu-daccès-rapide)
  - [Archives Zip](#archives-zip)
  - [Détection des lecteurs WSL](#détection-des-lecteurs-wsl)
  - [Édition des étiquettes](#édition-des-étiquettes)
  - [Mises à jour intégrées](#mises-à-jour-intégrées)
  - [Copier le chemin](#copier-le-chemin)
  - [Fermer les onglets en double](#fermer-les-onglets-en-double)
  - [Menus contextuels Accueil & Tableau de bord](#menus-contextuels-accueil--tableau-de-bord)
  - [Mode de fusion des effets visuels](#mode-de-fusion-des-effets-visuels)
- [Nouveaux paramètres](#nouveaux-paramètres)
- [Nouveaux raccourcis](#nouveaux-raccourcis)
- [Nouvelles langues](#nouvelles-langues)
- [Améliorations UX](#améliorations-ux)
  - [Améliorations de l'aperçu rapide](#améliorations-de-laperçu-rapide)
  - [Améliorations de la recherche rapide](#améliorations-de-la-recherche-rapide)
  - [Opérations sur les fichiers](#opérations-sur-les-fichiers)
  - [Effets visuels](#effets-visuels)
- [Améliorations de l'interface](#améliorations-de-linterface)
- [Corrections de bugs](#corrections-de-bugs)

### Nouvelles fonctionnalités

#### Système d'extensions

Système d'extensions complet avec marketplace ouvert.

- **Marketplace** : parcourez, installez et gérez les extensions depuis le marketplace ;
- **Installation locale** : vous pouvez installer des extensions depuis un dossier local ;
- **Palette de commandes** : nouvelle façon d'activer les commandes de l'application et des extensions ;
- **Capacités** : les extensions peuvent enregistrer des raccourcis locaux et globaux, des éléments de menu contextuel, des paramètres, des pages entières et des commandes ;
- **Gestion des versions** : vous pouvez installer différentes versions d'extensions et activer la mise à jour automatique ;
- **Localisation** : les extensions peuvent fournir des traductions pour différentes langues ;
- **Gestion des binaires** : les extensions peuvent utiliser des binaires (ffmpeg, deno, node, yt-dlp, 7z, et tout autre binaire existant) ;
- **Exécution isolée** : les extensions s'exécutent dans des sandboxes ESM isolées avec des permissions granulaires ;

#### Gestionnaire de fichiers par défaut

Vous pouvez maintenant définir SFM comme gestionnaire de fichiers par défaut sur Windows (`Paramètres > Expérimental`). Lorsque ce paramètre est activé, la plupart des actions système sur les fichiers seront redirigées vers SFM :

- Icône de l'application Explorateur de fichiers ;
- Raccourci `Ctrl+E` ;
- Révéler le fichier dans le dossier ;
- Afficher les téléchargements (lorsque vous téléchargez un fichier dans le navigateur) ;
- Commandes du terminal : "start {path}", "code {path}", etc.
- Et plus encore ;

Les vues système natives comme la « Corbeille », le « Panneau de configuration » et autres programmes profondément intégrés sont délégués à l'Explorateur de fichiers natif.

#### Partage en réseau local

Partagez et diffusez des fichiers et des répertoires sur votre réseau local directement depuis l'application.

Accédez au partage en réseau local depuis le bouton de la barre d'outils dans le navigateur ou depuis le menu contextuel sur n'importe quel fichier ou répertoire. Lorsqu'un partage est actif, un code QR et des URL partageables sont affichés. Deux modes sont disponibles :

- **Diffusion** : diffusez des fichiers et des répertoires vers n'importe quel appareil de votre réseau via un navigateur web ;
- **FTP** : partagez des fichiers via FTP pour un accès direct depuis d'autres applications. Vous pouvez télécharger et envoyer des fichiers depuis et vers l'ordinateur depuis un autre appareil ;

#### Menu d'accès rapide

Le bouton « Tableau de bord » dans la barre latérale fonctionne désormais comme un menu d'accès rapide. En survolant ce bouton, un panneau s'ouvre affichant vos Favoris et vos éléments Étiquetés.

Tous les éléments du panneau sont de véritables entrées de répertoire — vous pouvez glisser-déposer des éléments vers et depuis le panneau, ouvrir des menus contextuels avec un clic droit, et effectuer toutes les opérations standard sur les fichiers.

Peut être désactivé dans `Paramètres > Apparence de l'interface > Ouvrir le panneau d'accès rapide au survol`.

#### Archives Zip

Compressez et extrayez des archives zip directement depuis le menu d'actions du navigateur de fichiers :

- **Extraire** : extrayez un fichier `.zip` dans le répertoire courant ou dans un dossier nommé ;
- **Compresser** : compressez les fichiers et répertoires sélectionnés en une archive `.zip` ;

#### Détection des lecteurs WSL

Sur Windows, l'application détecte désormais automatiquement les distributions WSL installées et affiche leurs lecteurs dans le navigateur, vous permettant de parcourir les systèmes de fichiers WSL nativement.

#### Édition des étiquettes

Vous pouvez maintenant modifier les noms et les couleurs des étiquettes. Ouvrez le sélecteur d'étiquettes sur n'importe quel fichier ou répertoire pour renommer les étiquettes, changer leur couleur ou les supprimer.

#### Mises à jour intégrées

Vous pouvez maintenant télécharger et installer les mises à jour directement depuis la notification de mise à jour sans quitter l'application.

#### Copier le chemin

Ajout de l'option « Copier le chemin » dans le menu contextuel des fichiers et répertoires.

#### Fermer les onglets en double

Ajout de la possibilité de fermer les onglets en double depuis la barre d'onglets, supprimant tous les onglets pointant vers le même répertoire.

#### Menus contextuels Accueil & Tableau de bord

Les éléments de la page d'accueil et du tableau de bord disposent désormais de menus contextuels complets, offrant les mêmes fonctionnalités que dans le navigateur.

### Nouveaux paramètres

- **Afficher la bannière média de l'accueil** : afficher ou masquer la bannière média de la page d'accueil (`Paramètres > Apparence de l'interface > Bannière média de la page d'accueil`) ;
- **Délai des info-bulles** : configurer le délai avant l'apparition des info-bulles (`Paramètres > Apparence de l'interface > Info-bulles`) ;
- **Temps relatif** : afficher les horodatages récents en format relatif, par ex. « il y a 5 min » (`Paramètres > Général > Date / heure`) ;
- **Format de date et heure** : configurer le format du mois, le format régional, l'horloge 12 heures, les secondes et les millisecondes (`Paramètres > Général > Date / heure`) ;
- **Flou de l'arrière-plan des dialogues** : définir l'intensité du flou pour l'arrière-plan des dialogues (`Paramètres > Apparence de l'interface > Paramètres de style`) ;
- **Filtres de luminosité et de contraste** : ajuster les filtres de style de luminosité et de contraste pour l'interface de l'application (`Paramètres > Apparence de l'interface > Paramètres de style`) ;
- **Luminosité du média en superposition** : ajuster la luminosité du média en superposition des effets visuels (`Paramètres > Apparence de l'interface > Effets visuels`) ;
- **Mode de fusion des effets visuels** : ajuster le mode de fusion pour les effets visuels, vous permettant de choisir comment le média d'arrière-plan se mélange avec l'interface de l'application (`Paramètres > Apparence de l'interface > Effets visuels`) ;
- **Mettre en pause la vidéo d'arrière-plan** : mettre en pause la bannière d'accueil et la vidéo d'arrière-plan lorsque l'application est inactive ou réduite (`Paramètres > Apparence de l'interface > Effets visuels`) ;
- **Gestionnaire de fichiers par défaut** : définir Sigma File Manager comme explorateur de fichiers par défaut sur Windows (`Paramètres > Expérimental`) ;
- **Lancement au démarrage du système** : lancer automatiquement l'application lorsque vous vous connectez à votre système (`Paramètres > Général > Comportement au démarrage`) ;

### Nouveaux raccourcis

- **Copier le chemin du répertoire courant** (`Ctrl+Shift+C`) : copier le chemin du répertoire courant dans le presse-papiers ;
- **Recharger le répertoire courant** (`F5`) : actualiser la liste des fichiers du navigateur ;
- **Zoom avant / arrière** (`Ctrl+=` / `Ctrl+-`) : augmenter ou diminuer le zoom de l'interface ;
- **Plein écran** (`F11`) : basculer en mode plein écran ;

### Nouvelles langues

- **Hindi** ;
- **Ourdou** ;

### Améliorations UX

#### Améliorations de l'aperçu rapide

- **Navigation dans les médias** : naviguez entre les fichiers du répertoire courant sans fermer l'aperçu rapide ;
- **Aperçu des fichiers texte** : aperçu amélioré des fichiers texte avec détection correcte de l'encodage, édition en ligne et rendu du markdown ;

#### Améliorations de la recherche rapide

- **Toutes les propriétés** : recherchez par n'importe quelle propriété de fichier — nom, taille, nombre d'éléments, modifié, créé, accédé, chemin ou type MIME (par ex. `modified: today`, `mime: image`) ;
- **Plages de taille** : filtrez par taille en utilisant des comparaisons et des plages (par ex. `size: >=2mb`, `size: 1mb..10mb`) ;

#### Opérations sur les fichiers

- **Sécurité de résolution des conflits** : amélioration de la sécurité des fichiers dans la fenêtre de résolution des conflits pour prévenir la perte accidentelle de données ;
- **Collage à usage unique** : les éléments copiés ne peuvent être collés qu'une seule fois, empêchant les collages en double accidentels ;
- **Copier le texte** : permet de copier le texte de l'interface avec `Ctrl+C` lorsqu'aucun fichier n'est sélectionné ;

#### Effets visuels

- **Gestionnaire d'arrière-plan** : ajout d'un gestionnaire d'arrière-plan dans la page des paramètres pour une personnalisation centralisée de l'arrière-plan ;
- **Réinitialisation des effets d'arrière-plan** : ajout d'un bouton de réinitialisation pour les paramètres des effets d'arrière-plan ;

#### Autre

- **Réduction de la taille de l'application** : réduction de la taille du bundle en excluant les arrière-plans intégrés haute résolution et en utilisant des aperçus compressés dans l'éditeur de bannière média ;
- **Recherche globale** : affichage d'un bouton « afficher les paramètres » dans l'état vide et augmentation de la profondeur de recherche par défaut ;
- **Raccourcis Windows** : les fichiers `.lnk` ouvrent désormais leur cible dans le navigateur au lieu de les lancer en externe ;
- **Tableau de bord** : amélioration de la disposition de la section étiquetée ;
- **Menu contextuel de la barre d'adresse** : ajout d'un menu contextuel aux éléments de la barre d'adresse ;
- **Menu contextuel du navigateur** : affichage du menu contextuel lors d'un clic sur une zone vide du navigateur ;
- **Ouvrir dans un nouvel onglet** : ouvrir les répertoires dans un nouvel onglet avec un clic du bouton central de la souris ;
- **Défilement des onglets** : les onglets nouvellement ajoutés défilent automatiquement pour être visibles ;
- **Focus des menus** : les menus ne renvoient plus le focus à leur bouton déclencheur lorsqu'ils sont fermés par un clic extérieur ;
- **Fermer la recherche** : fermer la recherche globale avec `Escape` ;
- **Lancement plus rapide** : légère amélioration de la vitesse de lancement de l'application en préchargeant les paramètres en Rust ;
- **Répertoires utilisateur** : ajout de la possibilité d'ajouter et de supprimer des répertoires utilisateur sur la page d'accueil ;
- **Limites des listes** : diminution des limites pour les entrées fréquentes et d'historique afin d'améliorer les performances ;

### Améliorations de l'interface

- **Icônes de la barre d'outils** : uniformisation des couleurs des icônes de la barre d'outils dans l'application ;
- **Animations des cartes** : ajout d'effets de décalage et d'apparition progressive aux cartes ;
- **Thème clair** : amélioration des couleurs et du contraste du thème clair ;
- **Stabilité au lancement** : amélioration de la stabilité visuelle lors du lancement de l'application pour réduire le scintillement ;
- **Notifications** : amélioration du design des notifications pour une meilleure cohérence ;
- **Défilement automatique des onglets** : défilement automatique de l'onglet sélectionné pour le rendre visible lors de l'ouverture de la page du navigateur ;
- **Libellés du chemin racine** : normalisation des libellés du chemin racine dans les onglets et le panneau d'informations ;
- **Traductions** : amélioration des traductions dans l'application ;

### Corrections de bugs

- Correction du gel de l'interface lors de la copie ou du déplacement de nombreux éléments ; ajout de la progression des opérations de fichiers au centre d'état ;
- Correction du gel de l'interface lors de la suppression de nombreux éléments ; ajout de la progression de la suppression au centre d'état ;
- Correction du menu contextuel en vue grille qui ne s'ouvrait pas pour le répertoire courant lorsqu'un autre élément avait déjà un menu ouvert ;
- Correction du panneau d'informations n'affichant pas toutes les informations pour le répertoire courant ;
- Correction des raccourcis de l'application enregistrés sur la fenêtre d'aperçu rapide au lieu de la fenêtre principale uniquement ;
- Correction des fichiers glissés depuis les navigateurs web qui n'étaient pas traités ;
- Correction des noms de fichiers provenant de dépôts d'URL externes ne conservant pas les segments valides ;
- Correction de la bannière d'accueil qui était déplaçable ;
- Correction du cache des icônes système non indexé par chemin de fichier, causant des icônes incorrectes ;
- Correction des entrées racine Windows inaccessibles apparaissant dans le navigateur ;
- Correction des raccourcis personnalisés non identifiés sur certaines dispositions de clavier ;
- Correction des connexions SSHFS sur Linux ;
- Correction de la barre d'adresse créant des entrées d'historique en double lors d'un clic sur le fil d'Ariane ;
- Correction des résultats de la recherche globale ne répondant pas à la navigation au clavier ;
- Correction des résultats de la recherche globale ne s'ouvrant pas au clic ;
- Correction de l'état de la recherche globale ne se synchronisant pas après l'indexation incrémentale ;
- Correction du glisser-déposer sortant ne fonctionnant pas dans certaines applications ;
- Correction du design incohérent des badges de raccourcis dans l'application ;
- Correction de la visibilité des colonnes du navigateur dans les panneaux étroits ;

---

## [2.0.0-beta.2] - February 2026

**Résumé :** Raccourcis globaux, nouveaux paramètres, nouvelles fonctionnalités, filtrage de fichiers amélioré, barre d'adresse améliorée, améliorations de la bannière d'accueil et corrections de bugs.

### Raccourcis globaux

Vous pouvez désormais utiliser des raccourcis clavier pour interagir avec l'application même lorsqu'elle n'est pas au premier plan.

Raccourcis ajoutés :

- `Win+Shift+E` pour afficher et mettre au premier plan la fenêtre de l'application ;

### Nouveaux paramètres

Ajout d'un paramètre pour choisir ce qui se passe lorsque le dernier onglet est fermé.

![Paramètre fermer le dernier onglet](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### Nouvelles fonctionnalités

Ajout de nouvelles fonctionnalités en avant-première :

- Emplacements réseau : permet de connecter un emplacement réseau (SSHFS (SSH) / NFS / SMB / CIFS) ;
- [Linux] Montage de lecteurs : permet de démonter des emplacements ;

### Filtre de fichiers

Le filtre de fichiers a été amélioré :
- Désormais, lorsque vous changez de répertoire, il se vide et se ferme automatiquement ;
- La fonction « filtrer en tapant » s'active dans le panneau sélectionné, pas le premier ;

### Barre d'adresse

- Design amélioré et logique d'auto-complétion ;
- Les séparateurs de chemin sont désormais des menus déroulants qui permettent une navigation rapide vers n'importe quel répertoire parent ;

![Menus des séparateurs](./public/changelog/assets/beta-2/divider-menus.png)

### Bannière d'accueil / Effets d'arrière-plan

- Design amélioré de l'éditeur de bannière média :
  - Le menu des options de la bannière média s'ouvre désormais vers le bas pour éviter d'obstruer la vue ;
  - Vous pouvez maintenant cliquer à l'extérieur pour fermer l'éditeur de position de l'arrière-plan ;
  - Le champ URL déplacé au-dessus des arrière-plans personnalisés ;
- Les images/vidéos personnalisées peuvent être utilisées dans les effets visuels d'arrière-plan ;
- Suppression de certaines images de bannière média par défaut ;
- Ajout d'une nouvelle image de bannière « Exile by Aleksey Hoffman » ;

### Améliorations UX

- L'application restaure la position précédente de la fenêtre au lancement ;
- L'onglet courant peut désormais être fermé avec le raccourci `Ctrl+W` ou un clic du bouton central de la souris ;
- Augmentation de la taille des icônes de fichiers en vue grille ;

### Corrections de bugs

- Correction du déplacement de fichiers entre onglets les déplaçant parfois au mauvais emplacement ;
- Correction du navigateur affichant parfois de mauvaises icônes système pour les répertoires ;
- Correction de la création de plusieurs instances de l'application et de la barre système ;
- Correction du menu des extensions shell récupérant les données périodiquement, ce qui forçait la liste à défiler vers le haut en permanence ;

## [2.0.0-beta.1] - February 2026

**Résumé :** Améliorations majeures d'utilisabilité et de design incluant la navigation au clavier, de nouveaux raccourcis, l'ouverture dans le terminal, l'actualisation automatique des répertoires, le glisser-déposer, et des améliorations de la recherche et des vues en liste.

### Navigation au clavier

Naviguez dans les fichiers à l'aide du clavier avec un support complet pour les dispositions en grille et en liste et la vue divisée.

- Touches fléchées pour la navigation spatiale en vue grille et la navigation séquentielle en vue liste ;
- Entrée pour ouvrir le répertoire ou fichier sélectionné, Retour arrière pour revenir en arrière ;
- Ctrl+Gauche / Ctrl+Droite pour basculer le focus entre les panneaux de la vue divisée ;
- Ctrl+T pour ouvrir le répertoire courant dans un nouvel onglet ;
- Tous les raccourcis de navigation sont personnalisables dans Paramètres > Raccourcis ;

### Actualisation automatique des répertoires

La vue du navigateur s'actualise automatiquement lorsque des fichiers sont créés, supprimés, renommés ou modifiés dans le répertoire courant.

- Les tailles des fichiers se mettent à jour automatiquement lorsqu'elles sont modifiées par des applications externes ;
- Surveillance efficace du système de fichiers avec anti-rebond pour éviter les actualisations excessives ;
- Mises à jour intelligentes basées sur les différences ne modifiant que les éléments affectés, préservant la position de défilement et la sélection ;

### Glisser-déposer

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

Vous pouvez désormais glisser des fichiers et des dossiers pour les copier/déplacer facilement. Glissez entre les panneaux, depuis ou vers les listes de résultats de recherche, depuis ou vers des applications externes.

### Conflits de copie

Ajout d'une fenêtre modale pour une résolution facile des conflits de copie/déplacement.

### Mise à jour automatique

Ajout de la vérification automatique des mises à jour (peut être contrôlée depuis les paramètres).

### Éditeur de média de la bannière d'accueil

Ajout d'un éditeur pour la personnalisation de la bannière de la page d'accueil. Vous pouvez maintenant télécharger des images et vidéos personnalisées (les fichiers locaux et les URL distantes sont supportés)

### Améliorations de la vue en liste

- Design amélioré et correction de petits désagréments ;
- Ajout de la personnalisation de la visibilité des colonnes : choisissez quelles colonnes afficher ;
- Ajout du tri par colonnes : cliquez sur les en-têtes de colonnes pour trier les entrées ;
- La disposition par défaut du navigateur est passée en vue liste ;

### Améliorations de la recherche globale

- Disposition et design mis à jour avec support du glisser-déposer ;
- La recherche est désormais disponible pendant l'indexation des lecteurs ;

### Ouvrir dans le terminal

Ouvrez des répertoires dans votre terminal préféré directement depuis le menu contextuel.

- Détection automatique des terminaux installés sur Windows, macOS et Linux ;
- Windows Terminal affiche tous les profils shell configurés avec les icônes d'exécutables ;
- Le terminal par défaut de Linux est auto-détecté et affiché en premier ;
- Inclut les modes normal et administrateur/élevé ;
- Raccourci par défaut : Alt+T ;

### Localisation

- Ajout de la langue slovène (grâce à : @anderlli0053) ;

### Améliorations UI / UX

- Ajout d'un sélecteur de police : choisissez la police de l'interface parmi les polices système installées ;
- Ajout d'un menu « Créer nouveau » pour créer rapidement des fichiers ou des répertoires ;
- Affichage d'une vue d'état vide lors de la navigation vers des répertoires vides ;
- La barre d'état affiche le nombre total d'éléments avec le nombre masqué lorsque la liste est filtrée ;
- Les éléments nouvellement créés, copiés et déplacés défilent automatiquement pour être visibles ;
- La barre d'outils du presse-papiers affichée une seule fois sous les panneaux au lieu de dans chaque panneau ;
- Design simplifié de la fenêtre de renommage ;
- Icônes de la barre d'outils responsives qui se replient dans un menu déroulant pour les petites fenêtres ;
- Suppression de l'onglet « Navigation » vide des paramètres ;
- Le renommage d'un répertoire met désormais à jour son chemin dans tous les onglets, espaces de travail, favoris, étiquettes, historique et éléments fréquents ;
- La suppression d'un fichier ou répertoire le retire désormais de toutes les listes stockées et redirige les onglets concernés vers l'accueil ;
- Les chemins inexistants dans les favoris, étiquettes, historique et éléments fréquents sont désormais nettoyés automatiquement au démarrage ;

### Corrections de bugs

- Correction de l'état d'indexation de la recherche globale ne se mettant pas à jour en temps réel ;
- Correction du panneau de la vue divisée ne se mettant pas à jour lorsque son répertoire est supprimé ou renommé depuis l'autre panneau ;
- Correction des onglets se chargeant avec une erreur lorsque leur chemin stocké n'existe plus ;
- Correction des icônes système affichant la même icône pour tous les fichiers du même type au lieu d'icônes uniques par fichier ;
- Correction des raccourcis clavier ne fonctionnant pas dans le second panneau de la vue divisée ;
- Correction des raccourcis clavier cessant de fonctionner après la navigation entre les pages ;
- Correction d'une fuite mémoire avec les écouteurs de touche du filtre non nettoyés au démontage ;
- Linux : ajout du support de la récupération de l'application par défaut dans le menu « ouvrir avec » ;

---

## [2.0.0-alpha.6] - January 2026

**Résumé :** Fenêtre Nouveautés, Aperçu rapide, améliorations du menu contextuel et nouveaux paramètres.

### Fenêtre Nouveautés

Une fenêtre de journal des modifications qui affiche les nouvelles fonctionnalités et améliorations pour chaque version.

- Apparaît automatiquement après les mises à jour (peut être désactivé) ;
- Parcourez toutes les versions ;
- Consultez les descriptions détaillées et les captures d'écran pour chaque fonctionnalité ;

### Aperçu rapide

Prévisualisez les fichiers sans les ouvrir complètement grâce à une fenêtre d'aperçu légère.

- Appuyez sur `Espace` ou l'option « Aperçu rapide » dans le menu contextuel pour visualiser rapidement les fichiers ;
- Fermez instantanément avec `Espace` ou `Escape`.
- Supporte les images, vidéos, audio, fichiers texte, PDF et plus encore ;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Calcul de la taille des répertoires

- La taille des répertoires est désormais calculée automatiquement ;
- Vous pouvez voir la taille totale de tous les répertoires, y compris tous les sous-répertoires et fichiers, dès que vous ouvrez un répertoire ;

![Ouvrir avec](./public/changelog/assets/alpha-6/size.png)

### Nouvelles options du menu contextuel

#### Ouvrir avec

- Choisissez quelle application utiliser pour ouvrir un fichier ;
- Configurez des préréglages personnalisés pour ouvrir des fichiers dans des applications avec des paramètres ;
- Visualisez toutes les applications compatibles pour n'importe quel type de fichier ;
- Définissez des applications par défaut pour des types de fichiers spécifiques ;

![Ouvrir avec](./public/changelog/assets/alpha-6/open-with.png)

#### Extensions shell

- Accédez aux éléments du menu contextuel shell de Windows ;
- Accédez aux extensions shell tierces (7-Zip, Git, etc.) ;

![Extensions shell](./public/changelog/assets/alpha-6/shell-extensions.png)

### Nouveaux paramètres

#### Détection des lecteurs

- Met l'application au premier plan lorsque des lecteurs amovibles sont connectés (peut être désactivé) ;
- Contrôlez le comportement d'ouverture automatique de l'Explorateur Windows pour les lecteurs amovibles ;

#### Filtrer en tapant

Commencez à taper n'importe où dans le navigateur pour filtrer instantanément les éléments du répertoire courant ;

#### Raccourci de recherche des paramètres

Nouveau raccourci clavier pour un accès rapide à la recherche dans les paramètres ;

#### Données statistiques utilisateur

- Ajout d'une section de paramètres statistiques ;
- Sur la page du tableau de bord, vous pouvez voir, naviguer, effacer l'historique, les favoris et les éléments fréquemment utilisés ;

### Améliorations de la recherche

Recherche globale améliorée avec un système hybride indexé + direct pour des résultats plus fiables et à jour.

- Les recherches prennent désormais systématiquement moins d'une seconde (~1 To de lecteur plein), quel que soit l'emplacement des fichiers sur vos lecteurs ;
- Lorsque vous recherchez dans vos « chemins prioritaires » (ceux que vous ouvrez souvent), vous obtenez des résultats instantanément et les fichiers sont trouvés même s'ils viennent d'être créés et n'ont pas encore été indexés.

#### Les chemins prioritaires incluent :
- Répertoires utilisateur : Téléchargements, Documents, Bureau, Images, Vidéos, Musique ;
- Favoris ;
- Récemment ouverts ;
- Fréquemment utilisés ;
- Étiquetés ;

---

## [2.0.0-alpha.5] - January 2026

**Résumé :** Opérations sur les fichiers, recherche globale et personnalisation des raccourcis.

### Recherche globale

Recherche puissante sur tout le disque qui indexe et recherche des fichiers sur tous vos lecteurs. Comprend la correspondance approximative pour trouver des fichiers même avec des fautes de frappe, la ré-indexation automatique périodique, l'indexation prioritaire des répertoires fréquemment utilisés et l'analyse parallèle optionnelle pour une indexation plus rapide.

![Recherche globale](./public/changelog/assets/alpha-5/search.png)

### Opérations sur les fichiers

Support complet des opérations sur les fichiers avec copie, déplacement et suppression incluant le suivi de la progression. Inclut également le renommage de fichiers et dossiers sur place.

### Éditeur de raccourcis

Personnalisez tous les raccourcis clavier de l'application. Visualisez les associations actuelles, détectez les conflits et réinitialisez les valeurs par défaut.

### Améliorations du navigateur

Ajout de l'option d'afficher les icônes système natives pour les fichiers et répertoires au lieu de glyphes minimalistes. Les onglets de navigation des paramètres restent désormais fixés en haut de la page lors du défilement.

---

## [2.0.0-alpha.4] - January 2026

**Résumé :** Page d'accueil, effets visuels et options de personnalisation utilisateur.

### Page d'accueil

Une belle page d'accueil avec une bannière média animée, une liste de lecteurs et un accès rapide aux répertoires utilisateur courants comme Documents, Téléchargements, Images et plus encore.

### Effets visuels

Section d'effets visuels personnalisables dans les paramètres qui ajoute du flou, de l'opacité et des effets de bruit à l'arrière-plan de l'application. Supporte des paramètres différents pour chaque page.

### Éditeur de répertoires utilisateur

Personnalisez vos cartes de répertoires utilisateur avec des titres, icônes et chemins personnalisés. Personnalisez l'apparence de vos répertoires d'accès rapide sur la page d'accueil.

### Éditeur de position de la bannière

Ajustez finement la position de vos arrière-plans de bannière de la page d'accueil. Ajustez le zoom, le positionnement horizontal et vertical pour un rendu parfait.

### Améliorations des paramètres

- La recherche dans les paramètres fonctionne désormais dans toutes les langues, pas seulement la langue courante ;
- L'application restaure le dernier onglet de paramètres visité au rechargement au lieu d'ouvrir le premier à chaque fois ;

---

## [2.0.0-alpha.3] - December 2025

**Résumé :** Vue du navigateur avec onglets, espaces de travail et un nouveau système de design.

### Vue du navigateur

L'expérience de navigation de fichiers principale avec un système d'onglets moderne supportant les espaces de travail, un nouveau design de barre d'outils de fenêtre avec des contrôles intégrés, et une navigation à double panneau pour une gestion efficace des fichiers.

### Miniatures vidéo

Ajout de miniatures d'aperçu pour les fichiers vidéo dans le navigateur.

### Migration du système de design

Migration de l'application de Vuetify vers Sigma-UI pour un design plus spacieux et moderne avec une qualité de code améliorée.

---

## [2.0.0-alpha.1] - January 2024

**Résumé :** Réécriture complète utilisant des technologies modernes.

### Migration Tauri

Sigma File Manager v2 a été reconstruit de zéro en utilisant Vue 3 Composition API, TypeScript et Tauri v2. La taille d'installation de l'application est passée de 153 Mo à seulement 4 Mo sur Windows. La taille de l'application installée est passée de 419 Mo à 12 Mo.

### Panneaux redimensionnables

Ajout de la fonctionnalité de panneaux redimensionnables qui permet de diviser la vue du navigateur en deux et de travailler avec 2 répertoires côte à côte.

### Fonctionnalités initiales

Navigation de fichiers basique avec listing de répertoires, gestion de fenêtre avec les contrôles réduire, agrandir et fermer, et une structure initiale de page de paramètres.

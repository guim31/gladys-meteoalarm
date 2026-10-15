# MeteoAlarm

Les vigilances météo officielles de 38 pays européens dans Gladys : Belgique,
Suisse, Luxembourg, Allemagne, Espagne, Italie, Pays-Bas, Irlande,
Autriche… et la France. Les services météo nationaux (IRM, MétéoSuisse,
MeteoLux, DWD, AEMET, Met Éireann…) les publient sur
[MeteoAlarm](https://meteoalarm.org), géré par EUMETNET ; l'intégration lit
ces flux publics. Aucun compte, aucune clé.

Cette intégration n'est affiliée ni à EUMETNET ni à MeteoAlarm. Elle a été
développée sans accès au flux en direct, à partir d'échantillons réels
publiés : vos retours sont bienvenus sur le forum Gladys ou dans les issues
GitHub.

## Ce que fait l’intégration

- **Un appareil par zone suivie** (province, canton, comté, département…),
  et en option un pour une maison de Gladys.
- Sur chaque appareil : le **niveau de vigilance maximal en cours** (vert,
  jaune, orange, rouge), le niveau **par phénomène** (vent, pluie, orages,
  neige-verglas, canicule, grand froid, avalanches, feux de forêt,
  vagues-submersion, brouillard, crues, pluie-inondation), et les textes :
  vigilances en cours et à venir, description, début et fin.
- Un **widget de tableau de bord** qui liste les vigilances d'une zone avec
  leur couleur, leur phénomène, leurs horaires et leur texte complet.
- Deux **déclencheurs de scène** : « Nouvelle vigilance météo » (souvent la
  veille de son début) et « Vigilance météo levée ».
- Lecture seule : l'intégration ne pilote rien.

Pour la France, l'intégration Météo-France (autre auteur) suit la vigilance
départementale plus en détail. Celle-ci vise surtout les pays voisins et les
frontaliers, avec le même outil des deux côtés de la frontière.

## Prérequis

- Gladys **5.2.0** ou plus récent.
- Un accès Internet depuis la machine de Gladys : les flux sont sur
  `feeds.meteoalarm.org`.
- Pour suivre une maison : une maison **localisée** dans Gladys (Paramètres →
  Maisons), dans un pays dont le service météo donne le contour de ses zones
  de vigilance (voir [Limites](#limites)).

## Configuration

1. Installez l'intégration : **Intégrations → Installer depuis GitHub**,
   adresse `https://github.com/guim31/gladys-meteoalarm`.
2. Dans son onglet **Configuration**, choisissez le **pays**.
3. Saisissez vos **zones**, séparées par des virgules (10 au plus) : le nom
   de la zone tel qu'il apparaît sur meteoalarm.org (ex. `Liège`,
   `Haute Savoie`, `Strathclyde`), ou son code (l'`EMMA_ID` de MeteoAlarm
   comme `BE009`, ou le code national du flux comme `FR718`). Les accents,
   majuscules et tirets n'ont pas d'importance, mais le nom doit être
   complet : `Savoie` n'est pas `Haute Savoie`.
4. En option, choisissez une **maison** : l'intégration suit alors les
   vigilances dont la zone la contient.
5. Choisissez la **langue** des noms de fonctionnalités et des textes
   (français par défaut) et la **relève** (toutes les 10 ou 15 minutes).
6. Enregistrez, puis ajoutez les appareils depuis l'onglet **Découverte**.

L'action **Lister les zones** lit le flux tout de suite et liste les zones
connues pour le pays avec leur code, et si les vôtres ont été trouvées. Un
flux ne liste que les zones qui ont une vigilance aujourd'hui : la liste
s'enrichit à chaque vigilance vue depuis l'installation, et « pas encore
vue » à côté d'une de vos zones veut simplement dire qu'elle n'a pas eu de
vigilance depuis. Vérifiez dans ce cas son orthographe sur meteoalarm.org.

L'identifiant d'un appareil de zone vient de ce que vous saisissez (accents et
majuscules ignorés) : saisir `BE009` au lieu de `Liège` crée un autre
appareil.

## Relève et conditions d’utilisation

- Le flux du pays est lu **toutes les 10 ou 15 minutes** (une requête pour
  toutes vos zones), avec `If-None-Match` / `If-Modified-Since` : un flux
  inchangé coûte une réponse 304.
- Le détail d'une vigilance (document CAP : textes, langues, contours des
  zones) est lu **une seule fois** par version de la vigilance, et seulement
  pour les zones suivies. Une maison a besoin du détail de toutes les
  vigilances du pays, lu 40 au plus par relève.
- Entre deux lectures, les heures de début et de fin sont vérifiées **chaque
  minute** sans aucune requête : une vigilance entre en vigueur et se termine
  à la minute.
- L'intégration ne compte pas sur Gladys pour interroger ses appareils : elle
  se rafraîchit d'elle-même.
- MeteoAlarm publie ces flux pour un usage public et n'annonce aucun quota de
  requêtes ; l'intégration reste très loin d'une requête par minute,
  s'identifie (User-Agent) et cite sa source dans le widget. Lisez les
  conditions d'utilisation sur meteoalarm.org. Les vigilances restent celles
  des services météo nationaux : pour toute décision, référez-vous à leurs
  canaux officiels.

## Appareils

Chaque zone (ou maison) donne un appareil « MeteoAlarm <zone> ». Les noms des
fonctionnalités sont fixés dans la langue configurée à l'ajout de l'appareil.

| Fonctionnalité                   | Type             | Valeur                                                            |
| -------------------------------- | ---------------- | ----------------------------------------------------------------- |
| Niveau de vigilance maximal      | niveau de risque | 0 vert (aucune vigilance), 1 jaune, 2 orange, 3 rouge             |
| Vigilance vent, Vigilance pluie… | niveau de risque | idem, pour un phénomène (12 fonctionnalités)                      |
| Vigilances en cours et à venir   | texte            | « Orange : Vent (jeu. 15 oct., 06:00 → jeu. 15 oct., 21:00) · … » |
| Description de la vigilance      | texte            | titre et description de la vigilance principale                   |
| Début, Fin de la vigilance       | texte            | sa période, dans le fuseau horaire de Gladys                      |

Gladys affiche les niveaux de risque en pastilles de couleur : « Pas de
risque » vert, « Faible » jaune, « Moyen » orange, « Élevé » rouge — les
couleurs de MeteoAlarm.

Les fonctionnalités de niveau ne comptent que les vigilances **en cours**.
Une vigilance annoncée pour demain apparaît tout de suite dans le texte, dans
le widget et dans le déclencheur « Nouvelle vigilance météo ». La vigilance
principale est la plus haute en cours, sinon la prochaine annoncée. Les
textes sont dans la langue configurée quand l'émetteur l'écrit, sinon en
anglais, sinon dans la langue du pays.

## Widget du tableau de bord

Ajoutez le widget **Vigilances météo** à un tableau de bord et choisissez une
zone dans ses réglages. Il montre le niveau maximal, puis les vigilances en
cours (la plus haute d'abord) et celles annoncées, chacune avec sa couleur,
son phénomène et sa période. Un appui sur une vigilance ouvre son texte
complet : titre, description et conseils du service météo. Les textes suivent
la langue du tableau de bord quand l'émetteur l'écrit. La dernière ligne cite
la source, ou dit que MeteoAlarm ne répond pas et que les vigilances
affichées peuvent être périmées.

## Déclencheurs de scène

Dans l'éditeur de scènes (catégorie Intégrations) :

- **Nouvelle vigilance météo** : une vigilance apparaît sur une zone, ou son
  niveau monte (vent jaune, puis vent orange : annoncé deux fois ; un niveau
  plus bas n'est pas une nouvelle). Il se déclenche souvent la veille du
  début de la vigilance. Filtres : la zone, les niveaux (jaune, orange,
  rouge), les phénomènes. Variables : `{{triggerEvent.data.zone}}`, `level`
  (`yellow`, `orange`, `red`), `level_label`, `phenomenon`,
  `phenomenon_label`, `in_force` (vrai si déjà en cours), `period` (en toutes
  lettres), `onset` et `expires` (dates ISO), `headline`, `description`,
  `instruction`.
- **Vigilance météo levée** : une zone n'a plus de vigilance pour un
  phénomène, terminée ou retirée. Filtres : la zone, les phénomènes.
  Variables : `zone`, `level`, `level_label` (le dernier niveau),
  `phenomenon`, `phenomenon_label`.

La première lecture après l'installation est silencieuse (installer en pleine
tempête ne lance pas toutes les scènes d'un coup), et un redémarrage
n'annonce pas de nouveau ce qui l'a déjà été. Pour agir sur un niveau **en
cours**, utilisez le déclencheur habituel « valeur d'un appareil » sur les
fonctionnalités de niveau.

## Exemples de scènes

- **Vent annoncé** : déclencheur « Nouvelle vigilance météo », niveaux orange
  et rouge, phénomène vent → envoyer le message « Vigilance
  {{triggerEvent.data.level_label}}, {{triggerEvent.data.phenomenon_label}} :
  {{triggerEvent.data.period}}. {{triggerEvent.data.headline}} ».
- **Orange ou rouge en cours** : déclencheur « valeur d'un appareil » sur
  « Niveau de vigilance maximal » de votre zone, supérieur ou égal à 2 →
  allumer la lampe de l'entrée en orange ; une autre scène à 0 l'éteint.
- **Canicule** : « Vigilance canicule » supérieure ou égale à 1 → fermer les
  volets côté sud à 11 h tant qu'elle dure.
- **Fin de la vigilance** : déclencheur « Vigilance météo levée » → envoyer
  « La vigilance {{triggerEvent.data.phenomenon_label}} est terminée pour
  {{triggerEvent.data.zone}} ».

## Dépannage

- **« Choisissez le pays de vos zones » / « Saisissez au moins une zone »** :
  la configuration est incomplète.
- **« MeteoAlarm n'a pas de flux pour ce pays »** : l'adresse du flux a
  répondu 404. Signalez-le : MeteoAlarm l'a peut-être renommée.
- **« MeteoAlarm ne répond pas »** : réseau ou service en panne. La dernière
  lecture reste en place et l'intégration réessaie à chaque relève ; les
  journaux le disent une fois, et une fois quand le service répond de
  nouveau.
- **Une zone reste verte alors que meteoalarm.org montre une vigilance** :
  lancez **Lister les zones** et comparez l'orthographe, ou saisissez le code
  qui y figure.
- **Pas de description, seulement le titre** : le détail de la vigilance n'a
  pas pu être lu ; il est retenté après la lecture suivante du flux.
- **« Le flux de ce pays ne donne pas le contour des zones »** : la maison ne
  peut pas être placée ; suivez des zones.
- **La maison n'a pas de position** : renseignez-la dans Paramètres →
  Maisons.
- Journaux détaillés : lancez l'intégration avec `LOG_LEVEL=debug`. Un cycle
  normal n'écrit rien au niveau info.

## Limites

- Développée sans accès au flux en direct (l'environnement de développement
  ne pouvait pas le joindre) : testée sur de vrais flux publiés avec la
  bibliothèque `meteoalert-api` (France, Irlande, Royaume-Uni, 2022) et sur
  un flux belge synthétique. La liste des pays suit les adresses utilisées
  par cette bibliothèque. Vos retours sont bienvenus.
- Un flux ne liste que les zones qui ont une vigilance : il n'existe pas de
  liste complète des zones d'un pays, d'où les noms et codes à saisir.
- Le suivi d'une maison ne marche que si le service météo donne le contour de
  ses zones dans le détail des vigilances (l'Irlande le fait, la France et le
  Royaume-Uni ne le faisaient pas dans les échantillons).
- Un pays par installation, 10 zones au plus.
- Les textes sont ceux des services météo : leur langue dépend de
  l'émetteur.
- MeteoAlarm qualifie ce flux Atom de « legacy » : s'il est retiré,
  l'intégration devra suivre.
- Ce n'est pas un système d'alerte officiel : pour toute décision,
  référez-vous au service météo national.

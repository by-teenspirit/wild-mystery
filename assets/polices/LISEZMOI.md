# Les polices embarquées

## OpenDyslexic (`opendyslexic-regular.woff2`, `opendyslexic-bold.woff2`)

Posée par le réglage de confort « Police pour la dyslexie » (feuille 12).
Elle n'est téléchargée QUE si le réglage est coché : un navigateur ne va
chercher une police que lorsqu'un élément rendu s'en sert. Tant que la
case est décochée, le `@font-face` ne coûte aucune requête, et le
garde-fou du harnais de confort le vérifie.

· Version : la 1.0.3 du paquet npm `open-dyslexic`, convertie de TTF en
  WOFF2 avec `fontTools` — 138 ko deviennent 40.
· Seules la régulière et la grasse sont embarquées. L'italique et la
  grasse italique pèsent 270 ko chacune pour un usage rare sur un forum ;
  le navigateur les synthétise.

### Licence

OpenDyslexic est dérivée de Bitstream Vera Sans, sous la licence
Bitstream Vera, qui autorise la copie, la modification et la
redistribution à condition que l'avis ci-dessous accompagne les copies.
Le voici, et c'est la raison d'être de ce fichier.

> Copyright (c) 2003 by Bitstream, Inc. All Rights Reserved. Bitstream
> Vera is a trademark of Bitstream, Inc.
>
> Permission is hereby granted, free of charge, to any person obtaining a
> copy of the fonts accompanying this license ("Fonts") and associated
> documentation files (the "Font Software"), to reproduce and distribute
> the Font Software, including without limitation the rights to use,
> copy, merge, publish, distribute, and/or sell copies of the Font
> Software, and to permit persons to whom the Font Software is furnished
> to do so, subject to the following conditions:
>
> The above copyright and trademark notices and this permission notice
> shall be included in all copies of one or more of the Font Software
> typefaces.
>
> The Font Software may be modified, altered, or added to, and in
> particular the designs of glyphs or characters in the Fonts may be
> modified and additional glyphs or characters may be added to the Fonts,
> only if the fonts are renamed to names not containing either the words
> "Bitstream" or the word "Vera".
>
> This License becomes null and void to the extent applicable to Fonts or
> Font Software that has been modified and is distributed under the
> "Bitstream Vera" names.
>
> The Font Software may be sold as part of a larger software package but
> no copy of one or more of the Font Software typefaces may be sold by
> itself.
>
> THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
> EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
> MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
> OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL
> BITSTREAM OR THE GNOME FOUNDATION BE LIABLE FOR ANY CLAIM, DAMAGES OR
> OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL,
> OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR
> OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE THE FONT
> SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.

### Ce qu'elle vaut, honnêtement

Les études contrôlées ne lui trouvent pas d'avance mesurable sur une
sans-serif ordinaire à l'empattement et à l'espacement équivalents. Ce
qui aide, et qui se mesure, c'est l'ESPACEMENT — interligne, interlettre,
intermot —, et c'est l'objet du réglage voisin.

Elle est quand même là parce que des lecteurs la demandent et s'y
trouvent mieux, et qu'un réglage qu'on peut décocher ne coûte rien à qui
n'en veut pas. Elle n'est simplement pas le réglage à recommander en
premier.

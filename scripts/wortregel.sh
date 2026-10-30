#!/usr/bin/env bash
# Wortregel-Gate fuer /affoltern/ (Plan prize-anfrageseite, Segment 2).
#
# Die Seite bietet einen Hotelaufenthalt an, keine Wohnung und keine Vermietung, und nennt keine
# Fremdmarke. Diese Woerter duerfen in keinem Text der Seiten stehen (sichtbar oder im Code):
# die Liste von website-backend hotel_briefe.SPERRWOERTER ohne Betraege, plus Kaution,
# Monatsmiete, die Marken und die Zusage einer woechentlichen Reinigung (Zwischenreinigung ist
# alle 14 Tage; der woechentliche Bettwaeschewechsel darf stehen, Entscheid 30.10.2026). "Wohnsitz"
# bleibt als ganzes Wort gesperrt, "Wohnsitznahme" im Pflichtzusatz der Stadt ist ein anderes Wort.
# Ganze Woerter, Gross- und Kleinschreibung egal. Exit 1 bei einem Treffer.
set -euo pipefail
cd "$(dirname "$0")/.."
ziel=("${@:-affoltern}")
woerter=(
  Longstay Apartment Apartments Wohnung Wohnungen Miete mieten Mietvertrag Wohnsitz Studio Zuhause
  Wohnen moebliert möbliert "pro Monat" Monatszimmer "mindestens 30 Tage" Kaution Monatsmiete
  Radisson Prizeotel "Reinigung jede Woche" "wöchentliche Reinigung" "woechentliche Reinigung"
  "weekly cleaning" "cleaning every week" "cleaned weekly"
)
muster=()
for w in "${woerter[@]}"; do muster+=(-e "$w"); done
treffer=$(grep -r -n -i -w --include='*.html' --include='*.js' --include='*.css' "${muster[@]}" "${ziel[@]}" || true)
if [ -n "$treffer" ]; then
  echo "$treffer"
  echo "Wortregel: $(printf '%s\n' "$treffer" | wc -l | tr -d ' ') Treffer"
  exit 1
fi
echo "Wortregel: 0 Treffer in ${ziel[*]}"

# Feed fixtures

Real MeteoAlarm answers, from the tests of
[`meteoalert-api`](https://github.com/rolfberkenbosch/meteoalert-api) (MIT,
© 2018 Rolf Berkenbosch), the library behind the Home Assistant `meteoalarm`
integration:

| File                              | Source file                            | Content                                                        |
| --------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| `france.atom.xml`                 | `france_sample.xml`                    | Atom feed, December 2022: yellow avalanches over 6 areas       |
| `france-avalanches.cap.xml`       | `france_sample_detail.xml`             | CAP, `fr-FR` and `en-GB` texts, no area outline                |
| `united-kingdom.atom.xml`         | `uk_sample.xml`                        | Atom feed, yellow snow and ice, `EMMA_ID` geocodes             |
| `united-kingdom-ice.cap.xml`      | `uk_nothern_ireland_sample_detail.xml` | CAP, `en-GB` only, no area outline                             |
| `ireland.atom.xml`                | `ireland_sample.xml`                   | Atom feed, yellow low temperature: the first 20 of 232 entries |
| `ireland-low-temperature.cap.xml` | `ireland_sample_detail.xml`            | CAP with `<polygon>` outlines of the area                      |

Synthetic, written for these tests on the exact structure of the real files
(no live feed was reachable from the development session; the area codes are
invented):

| File                   | Content                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `belgium.atom.xml`     | Atom feed, 15 October 2026: orange wind in force, yellow rain announced, a cancelled warning, a test message, an expired one, a green one |
| `belgium-wind.cap.xml` | CAP in `nl-BE`, `fr-BE`, `de-DE` and `en-GB`, with polygon outlines of the two areas                                                      |
| `belgium-rain.cap.xml` | CAP in `fr-BE` and `en-GB` only, no outline                                                                                               |

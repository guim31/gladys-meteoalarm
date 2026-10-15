# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- The official weather warnings of 38 European countries, read from the public
  MeteoAlarm feeds (no account): choose a country and type your zones, by name
  or code.
- One device per zone: the highest warning level in force and the level per
  phenomenon (wind, rain, thunderstorms, snow and ice, heat, cold, avalanches,
  forest fire, coastal event, fog, flooding, rain and flooding), shown as
  green / yellow / orange / red badges, plus the current and upcoming
  warnings, the description of the main one, its start and end.
- Optionally, a device for a house of Gladys, with the warnings whose area
  contains it, where the weather service outlines its areas.
- Scene triggers "New weather warning" (often the day before it starts, with
  level, phenomenon, period and texts) and "Weather warning lifted".
- Dashboard widget "Weather warnings": the warnings of a zone, in force and
  announced, with their color, phenomenon, times and full text.
- Configuration action "List the zones": the zones known for the country, with
  their codes, and whether yours were found.
- Feature names and texts in English, French, German or Spanish; warning texts
  in that language when the weather service writes it.
- Refresh every 10 or 15 minutes, start and end times followed to the minute.
- Documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-meteoalarm/commits/main

# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- **No secret.** The MeteoAlarm feeds are public: no account, no key, no
  password in the configuration or under `/data`.
- **Location.** The manifest declares `location: true` to read the
  coordinates of the house chosen in the configuration, only to place it in
  the warning areas. They are never logged, never stored under `/data` and
  never sent anywhere.
- **`/data/meteoalarm.json`**: the zones seen in the feeds (names and codes),
  the warning levels each device already announced, and whether a country
  outlines its areas. Nothing personal.
- **Network**: outbound HTTPS only, to `feeds.meteoalarm.org` (the Atom feed
  of the configured country, and the CAP documents it links — any other host
  linked by a feed is refused). No port opened, no local network access.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the MeteoAlarm service and the warnings of the weather services.

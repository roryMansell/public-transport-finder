# Ingesting Bus Open Data Service feeds (BODS)

> The goal is to keep everything free. These steps only use official, no-cost resources.

1. Create a BODS account and generate an API key (no payment details required).
2. Download the static GTFS feed for your operator:
   ```bash
   curl -H "x-api-key: $BODS_API_KEY" \
     "https://data.bus-data.dft.gov.uk/gtfs/feed/\$OPERATOR_ID/latest/download" \
     -o ../data/bods/latest.zip
   unzip -o ../data/bods/latest.zip -d ../data/bods/static
   ```
3. Download the corresponding realtime SIRI-VM or GTFS-RT feed:
   ```bash
   curl -H "x-api-key: $BODS_API_KEY" \
     "https://data.bus-data.dft.gov.uk/gtfsrt/trip-updates?operatorRef=$OPERATOR_ID" \
     -o ../data/bods/latest-trip-updates.pb
   ```
4. Point the backend ingestor at the downloaded files. Because the backend speaks GeoJSON internally you can parse the
   protobuf payload once and replay it during development.

For Greater Manchester the Stagecoach (operator 9) feed provides dense coverage of the Magic Bus routes.

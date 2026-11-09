# Fair price agent

Compares each apartment in a deal with nearby officially reported sales and produces a report
showing the fair value, the saving, and every advantage of the deal (floor, size, rooms-for-price,
parking, storage, direction, street, facilities, Form 4).

```bash
node run.js examples/deal.example.json examples/sales.example.csv report.html            # internal report
node run.js examples/deal.example.json examples/sales.example.csv report.html --public   # hides house numbers
```

- `deal.json`: project, building, location, apartments, and optional `assumptions` overrides.
- `sales.csv`: reported sales near the building. Columns: `date, street, distanceM (or lat,lng), rooms, sizeM2, floor, price, newBuild, parking, storage`.
- All assumptions (floor premium, parking value, etc.) are in `engine.js` `DEFAULTS` and printed in every report.

The example files are SAMPLE data for testing, not real sales.

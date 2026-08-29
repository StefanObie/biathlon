import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const CARD_COUNT = 20; // spec §4.1: numbered 1-20, reusable, printed once

// A4 content box at 10pt page padding: 595.28 x 841.89pt page, so
// ~575pt wide x ~822pt tall to work with. 2 columns x 5 rows of fixed-point
// cards (rather than percentage heights, which round unpredictably against
// bordered flex-wrap children) keeps all 20 cards on 2 pages.
const CARD_WIDTH = 287;
const CARD_HEIGHT = 164;

const styles = StyleSheet.create({
  page: {
    padding: 10,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    border: "1pt solid #000",
    alignItems: "center",
    justifyContent: "center",
  },
  number: {
    fontSize: 72,
    fontFamily: "Helvetica-Bold",
  },
});

/**
 * Not scanned (spec §4.3) — the operator scans only the athlete's bib, the
 * card is a visual cross-check the marshal can read against the app's
 * on-screen position. No QR code needed here.
 */
export function PositionCardsDocument() {
  const numbers = Array.from({ length: CARD_COUNT }, (_, i) => i + 1);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {numbers.map((n) => (
          <View key={n} style={styles.card} wrap={false}>
            <Text style={styles.number}>{n}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

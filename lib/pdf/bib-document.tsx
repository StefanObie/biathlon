import {
  Document,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

import { buildQrPath } from "./qr-path";

export interface BibData {
  athleteNo: number;
  fullName: string;
  runHeat: number;
  swimHeat: number;
  swimLane: number;
}

const QR_MM = 25;
const PAGE_MARGIN_MM = 10;
const TAG_PADDING_MM = 2; // cutting-tolerance margin inside the tag border
// A4 width (210mm) minus left+right page margins, split 3 across.
const TAG_WIDTH_MM = (210 - PAGE_MARGIN_MM * 2) / 3;
const TAG_HEIGHT_MM = QR_MM + 4 + TAG_PADDING_MM * 2;

const styles = StyleSheet.create({
  page: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: `${PAGE_MARGIN_MM}mm`,
  },
  tag: {
    width: `${TAG_WIDTH_MM}mm`,
    height: `${TAG_HEIGHT_MM}mm`,
    border: "0.5pt solid #000",
    flexDirection: "row",
    alignItems: "center",
    padding: `${TAG_PADDING_MM}mm`,
  },
  left: {
    width: `${QR_MM}mm`,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 1,
  },
  qrWrapper: {
    width: `${QR_MM}mm`,
    height: `${QR_MM}mm`,
    backgroundColor: "#fff",
  },
  athleteNo: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },
  right: {
    flex: 1,
    height: "100%",
    paddingVertical: 2,
    paddingRight: 3,
    marginLeft: "4mm",
    justifyContent: "center",
  },
  name: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  heats: {
    fontSize: 9,
    color: "#333",
    marginTop: 1,
  },
});

function QrCode({ payload, sizeMm }: { payload: string; sizeMm: number }) {
  const { path, size } = buildQrPath(payload);
  return (
    <Svg
      width={`${sizeMm}mm`}
      height={`${sizeMm}mm`}
      viewBox={`0 0 ${size} ${size}`}
    >
      <Path d={path} fill="#000" />
    </Svg>
  );
}

function Bib({ athlete }: { athlete: BibData }) {
  return (
    <View style={styles.tag} wrap={false}>
      <View style={styles.left}>
        <View style={styles.qrWrapper}>
          <QrCode payload={`BCL-${athlete.athleteNo}`} sizeMm={QR_MM} />
        </View>
        <Text style={styles.athleteNo}>{athlete.athleteNo}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.name} hyphenationCallback={(word) => [word]}>
          {athlete.fullName}
        </Text>
        <Text style={styles.heats}>Run Heat {athlete.runHeat}</Text>
        <Text style={styles.heats}>Swim Heat {athlete.swimHeat}</Text>
        <Text style={styles.heats}>Swim Lane {athlete.swimLane}</Text>
      </View>
    </View>
  );
}

export function BibsDocument({ athletes }: { athletes: BibData[] }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {athletes.map((athlete) => (
          <Bib key={athlete.athleteNo} athlete={athlete} />
        ))}
      </Page>
    </Document>
  );
}

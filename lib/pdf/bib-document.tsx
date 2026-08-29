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

const QR_MM = 30; // spec §4.1: >=30mm square, ECC level Q, quiet zone maintained

const styles = StyleSheet.create({
  page: {
    padding: 10,
  },
  bib: {
    width: "100%",
    height: 130,
    border: "1pt solid #000",
    padding: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qrWrapper: {
    width: QR_MM,
    height: QR_MM,
    padding: 4, // quiet zone
    backgroundColor: "#fff",
  },
  info: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  athleteNo: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
  },
  name: {
    fontSize: 12,
    marginTop: 4,
  },
  heats: {
    fontSize: 9,
    color: "#333",
    marginTop: 2,
  },
});

function QrCode({ payload, sizeMm }: { payload: string; sizeMm: number }) {
  const { path, size } = buildQrPath(payload);
  return (
    <Svg width={sizeMm} height={sizeMm} viewBox={`0 0 ${size} ${size}`}>
      <Path d={path} fill="#000" />
    </Svg>
  );
}

function Bib({ athlete }: { athlete: BibData }) {
  return (
    <View style={styles.bib} wrap={false}>
      <View style={styles.qrWrapper}>
        <QrCode payload={`SAB-${athlete.athleteNo}`} sizeMm={QR_MM - 8} />
      </View>
      <View style={styles.info}>
        <Text style={styles.athleteNo}>{athlete.athleteNo}</Text>
        <Text style={styles.name}>{athlete.fullName}</Text>
        <Text style={styles.heats}>
          Run heat {athlete.runHeat} · Swim heat {athlete.swimHeat} · Lane{" "}
          {athlete.swimLane}
        </Text>
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

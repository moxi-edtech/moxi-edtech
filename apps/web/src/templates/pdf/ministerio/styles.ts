import { StyleSheet } from '@react-pdf/renderer'

export const medStyles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: '#fff',
  },
  headerWrapper: {
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 10,
  },
  republicaText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  subHeaderText: {
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  schoolName: {
    fontSize: 14,
    fontWeight: 'black',
    textTransform: 'uppercase',
    marginTop: 5,
    marginBottom: 5,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 10,
    textDecoration: 'underline',
  },
  table: {
    width: '100%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#000',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000',
    minHeight: 18,
    alignItems: 'center',
  },
  headerRow: {
    backgroundColor: '#e5e7eb',
    fontWeight: 'bold',
  },
  cell: {
    borderRightWidth: 1,
    borderColor: '#000',
    padding: 2,
    textAlign: 'center',
    fontSize: 8,
  },
  cellLeft: {
    textAlign: 'left',
    paddingLeft: 4,
  },
  redText: { color: '#dc2626' },
  bold: { fontWeight: 'bold' },
  watermark: {
    position: 'absolute',
    top: 200,
    left: 150,
    opacity: 0.05,
    transform: 'rotate(-45deg)',
    fontSize: 120,
    fontWeight: 'bold',
    color: '#000',
    zIndex: -1,
  },
})

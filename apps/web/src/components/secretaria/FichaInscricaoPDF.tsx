// apps/web/src/components/secretaria/FichaInscricaoPDF.tsx
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 30,
    },
    title: {
        fontSize: 24,
        textAlign: 'center',
        marginBottom: 20,
    },
    section: {
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 18,
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        paddingBottom: 5,
    },
    text: {
        fontSize: 12,
        marginBottom: 5,
    },
    bold: {
        fontWeight: 'bold',
    },
    paymentInfo: {
        marginTop: 20,
        padding: 10,
        backgroundColor: '#f0f0f0',
        borderRadius: 5,
    }
});

export const FichaInscricaoPDF = ({ candidatura }: { candidatura: any }) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <View>
                <Text style={styles.title}>Ficha de Inscrição</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Dados do Candidato</Text>
                <Text style={styles.text}><Text style={styles.bold}>Nome:</Text> {candidatura.nome_candidato}</Text>
                <Text style={styles.text}><Text style={styles.bold}>Email:</Text> {candidatura.dados_candidato.email}</Text>
                <Text style={styles.text}><Text style={styles.bold}>Telefone:</Text> {candidatura.dados_candidato.telefone}</Text>
                <Text style={styles.text}><Text style={styles.bold}>Nº do BI:</Text> {candidatura.dados_candidato.bi_numero}</Text>
            </View>
            
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Interesse Acadêmico</Text>
                <Text style={styles.text}><Text style={styles.bold}>Curso Pretendido:</Text> {candidatura.cursos?.nome}</Text>
                <Text style={styles.text}><Text style={styles.bold}>Classe Pretendida:</Text> {candidatura.classes?.nome}</Text>
            </View>

            <View style={styles.paymentInfo}>
                <Text style={styles.sectionTitle}>Instruções de Pagamento</Text>
                <Text style={styles.text}>Por favor, efectue o pagamento da taxa de matrícula para a seguinte conta:</Text>
                <Text style={styles.text}><Text style={styles.bold}>Banco:</Text> Exemplo Bank</Text>
                <Text style={styles.text}><Text style={styles.bold}>IBAN:</Text> AO06 0000 0000 0000 0000 0000 0</Text>
                <Text style={styles.text}><Text style={styles.bold}>Valor:</Text> [Valor da Matrícula] Kz</Text>
                <Text style={{...styles.text, marginTop: 10, fontSize: 10}}>
                    Esta pré-inscrição é válida por 48 horas (expira em: {new Date(candidatura.expires_at).toLocaleString()}).
                </Text>
            </View>
        </Page>
    </Document>
);

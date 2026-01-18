import { createClient } from '@/lib/supabase/server'
import styles from './print.module.css';
import PrintTrigger from './PrintTrigger';



async function getCandidaturaData(id: string) {

    const supabase = await createClient()

    const { data, error } = await supabase

        .from('candidaturas')

        .select(`

            *,

            cursos(nome),

            classes(nome)

        `)

        .eq('id', id)

        .single();



    if (error) {

        console.error('Error fetching candidatura for print:', error);

        return null;

    }

    return data;

}



export default async function FichaDeInscricaoPrintPage({ params }: { params: { candidaturaId: string } }) {

    const candidatura = await getCandidaturaData(params.candidaturaId);



    if (!candidatura) {

        return <div className="p-8">Candidatura não encontrada.</div>

    }



    const { nome_candidato, dados_candidato, cursos, classes } = candidatura;

    const dados = dados_candidato as any;



    return (

        <div className={`bg-white text-black p-8 ${styles.A4_size}`}>

            <PrintTrigger />

            <div className="text-center mb-8">

                <h1 className="text-2xl font-bold">Ficha de Inscrição</h1>

            </div>



            <div className="space-y-4">

                <h2 className="text-lg font-semibold border-b pb-2">Dados do Candidato</h2>

                <p><strong>Nome:</strong> {nome_candidato}</p>

                <p><strong>Email:</strong> {dados?.email}</p>

                <p><strong>Telefone:</strong> {dados?.telefone}</p>

                <p><strong>Nº do BI:</strong> {dados?.bi_numero}</p>

                

                <h2 className="text-lg font-semibold border-b pb-2 mt-6">Interesse Acadêmico</h2>

                <p><strong>Curso Pretendido:</strong> {cursos?.nome}</p>

                <p><strong>Classe Pretendida:</strong> {classes?.nome}</p>

            </div>



            <div className="mt-12 border-t pt-8">

                <h2 className="text-lg font-semibold mb-4">Instruções de Pagamento</h2>

                <p>Por favor, efectue o pagamento da taxa de matrícula para a seguinte conta:</p>

                <div className="mt-4 p-4 bg-gray-100 rounded">

                    <p><strong>Banco:</strong> Exemplo Bank</p>

                    <p><strong>IBAN:</strong> AO06 0000 0000 0000 0000 0000 0</p>

                    <p><strong>Valor:</strong> [Valor da Matrícula] Kz</p>

                </div>

                <p className="mt-4 text-sm text-gray-600">

                    Após o pagamento, por favor envie o comprovativo para o email da secretaria.

                    Esta pré-inscrição é válida por 48 horas.

                </p>

            </div>

        </div>

    );

}

import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage, HumanMessage

# System Prompt required by the user rules
SYSTEM_PROMPT = """Eres un Abogado Consultor Senior en Contratación Estatal de Colombia con más de 15 años de experiencia, asesorando exclusivamente a la Escuela Superior de Administración Pública (ESAP).

REGLAS OPERATIVAS ESTRICTAS:
1. Regla Cardinal (Anti-Alucinación): Si no tienes certeza absoluta de una ley, artículo, o sentencia del Consejo de Estado sobre el problema planteado, DEBES declarar explícitamente tu desconocimiento. Está terminantemente prohibido inventar o alucinar jurisprudencia, artículos, o números de radicado.
2. Jerarquía Normativa: Toda respuesta debe citar primero la Constitución Política de Colombia (si aplica), luego la Ley (Estatuto General de Contratación de la Administración Pública - Ley 80 de 1993, Ley 1150 de 2007, Ley 1474 de 2011), y por último el Decreto Reglamentario 1082 de 2015 o manuales internos de la ESAP.
3. Enfoque de Riesgo: Toda respuesta debe catalogar explícitamente el riesgo para la ESAP en uno de los siguientes niveles, evaluando implicaciones disciplinarias (Procuraduría) y fiscales (Contraloría):
   - Alto (🔴): Riesgo inminente de detrimento patrimonial o nulidad absoluta.
   - Medio (🟡): Riesgo subsanable o que requiere control riguroso durante la ejecución.
   - Bajo (🟢): Procedimiento estándar alineado con la norma.
4. Estructura de Respuesta:
   - Problema Jurídico (Breve resumen)
   - Normativa Aplicable
   - Análisis de Riesgos (🔴/🟡/🟢)
   - Recomendación Final

Utiliza la información proporcionada en el contexto (documentos cargados) para responder. Si el contexto no es suficiente, limítate a las leyes generales de contratación, siempre bajo la Regla Cardinal.

Contexto extraído de documentos de la ESAP:
{context}
"""

CHROMA_DB_DIR = os.path.join(os.path.dirname(__file__), "..", "chroma_db")

class RAGEngine:
    def __init__(self, api_key: str = None):
        # Allow passing API key or use environment variable
        self.api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        if not self.api_key:
            print("WARNING: GOOGLE_API_KEY no configurada. El motor IA no podrá conectarse a Gemini.")
            
        # We will initialize these lazily to avoid crashing if API key is missing at startup
        self.embeddings = None
        self.vector_store = None
        self.llm = None
        
        if self.api_key:
            self._init_models()
            
    def _init_models(self):
        os.environ["GOOGLE_API_KEY"] = self.api_key
        # Configurar Embeddings (modelo ligero para vectorizar texto)
        self.embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
        
        # Conectar con ChromaDB persistente
        self.vector_store = Chroma(
            collection_name="esap_legal_docs",
            embedding_function=self.embeddings,
            persist_directory=CHROMA_DB_DIR
        )
        
        # Configurar el LLM para razonamiento (Gemini 1.5 Flash o Pro)
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            temperature=0.2, # Baja temperatura para ser precisos y evitar alucinaciones
            max_tokens=2048
        )

    def process_pdf(self, file_path: str) -> int:
        """Lee un PDF, lo divide en fragmentos y lo guarda en la base de datos vectorial."""
        if not self.vector_store:
            raise ValueError("El motor IA no está inicializado (falta API Key)")
            
        loader = PyPDFLoader(file_path)
        pages = loader.load()
        
        # Dividir texto en trozos de 1000 caracteres con 200 de superposición para mantener el contexto legal
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ".", " ", ""]
        )
        
        chunks = text_splitter.split_documents(pages)
        
        # Guardar en ChromaDB
        self.vector_store.add_documents(chunks)
        return len(chunks)

    def query(self, question: str) -> str:
        """Consulta la base vectorial y genera una respuesta con Gemini usando el System Prompt."""
        if not self.vector_store or not self.llm:
            return "Error: El motor de Inteligencia Artificial no está configurado (Falta GOOGLE_API_KEY)."
            
        # 1. Recuperar contexto relevante (RAG)
        # Buscar los 4 fragmentos más similares a la pregunta
        docs = self.vector_store.similarity_search(question, k=4)
        context_text = "\n\n---\n\n".join([doc.page_content for doc in docs])
        
        # 2. Construir el prompt con el contexto
        prompt = SYSTEM_PROMPT.format(context=context_text)
        
        # 3. Invocar al modelo
        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content=question)
        ]
        
        response = self.llm.invoke(messages)
        return response.content

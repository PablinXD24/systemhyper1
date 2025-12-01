// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB3lORq3nF7mbcQc-YZObZvBwMXtVWQ5y4",
    authDomain: "systemhyper1.firebaseapp.com",
    projectId: "systemhyper1",
    storageBucket: "systemhyper1.firebasestorage.app",
    messagingSenderId: "65464629978",
    appId: "1:65464629978:web:2201ea8087f992310403e3"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Exportar serviços
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage?.();

// Configurar persistência de autenticação
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(error => {
        console.error("Erro ao configurar persistência:", error);
    });

// Função para criar admin padrão
async function createDefaultAdmin() {
    try {
        const adminEmail = 'admin@jj.com';
        const adminPassword = 'J&J2024';
        
        // Tentar criar usuário
        await auth.createUserWithEmailAndPassword(adminEmail, adminPassword);
        
        // Salvar dados do admin no Firestore
        await db.collection('usuarios').doc(adminEmail).set({
            email: adminEmail,
            nome: 'Administrador J&J',
            tipo: 'admin',
            criadoEm: new Date(),
            ativo: true
        });
        
        console.log('Admin padrão criado com sucesso');
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            console.log('Usuário admin já existe');
        } else {
            console.error('Erro ao criar admin:', error);
        }
    }
}

// Tentar criar admin ao carregar (apenas se não existir)
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // Verificar se já existe um admin
        const snapshot = await db.collection('usuarios')
            .where('email', '==', 'admin@jj.com')
            .limit(1)
            .get();
            
        if (snapshot.empty) {
            createDefaultAdmin();
        }
    } catch (error) {
        console.error('Erro ao verificar admin:', error);
    }
});

// Exportar funções úteis
window.firebaseServices = {
    auth,
    db,
    storage,
    
    // Função para formatar data do Firestore
    formatFirestoreDate: (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('pt-BR');
    },
    
    // Função para converter data para Firestore
    toFirestoreDate: (dateString) => {
        const date = new Date(dateString);
        return firebase.firestore.Timestamp.fromDate(date);
    },
    
    // Função para gerar ID único
    generateId: () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    // Função para fazer upload de arquivo
    uploadFile: async (file, path) => {
        if (!storage) {
            throw new Error('Storage não disponível');
        }
        
        const storageRef = storage.ref();
        const fileRef = storageRef.child(`${path}/${Date.now()}_${file.name}`);
        await fileRef.put(file);
        return await fileRef.getDownloadURL();
    },
    
    // Função para buscar dados com paginação
    fetchWithPagination: async (collectionName, filters = {}, limit = 20, lastDoc = null) => {
        let query = db.collection(collectionName);
        
        // Aplicar filtros
        Object.keys(filters).forEach(key => {
            if (filters[key] !== undefined && filters[key] !== '') {
                query = query.where(key, '==', filters[key]);
            }
        });
        
        // Ordenar por data de criação
        query = query.orderBy('criadoEm', 'desc');
        
        // Aplicar paginação
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }
        
        query = query.limit(limit);
        
        const snapshot = await query.get();
        const data = [];
        snapshot.forEach(doc => {
            data.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return {
            data,
            lastDoc: snapshot.docs[snapshot.docs.length - 1] || null
        };
    },
    
    // Função para contar documentos
    countDocuments: async (collectionName, field = null, value = null) => {
        let query = db.collection(collectionName);
        
        if (field && value !== null) {
            query = query.where(field, '==', value);
        }
        
        const snapshot = await query.get();
        return snapshot.size;
    },
    
    // Função para buscar estatísticas
    getDashboardStats: async () => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);
        
        const stats = {
            totalProdutos: 0,
            vendasHoje: 0,
            estoqueBaixo: 0,
            totalClientes: 0,
            faturamentoHoje: 0
        };
        
        try {
            // Contar produtos
            const produtosSnapshot = await db.collection('produtos').get();
            stats.totalProdutos = produtosSnapshot.size;
            
            // Contar produtos com estoque baixo
            produtosSnapshot.forEach(doc => {
                const produto = doc.data();
                if (produto.estoque <= produto.estoqueMinimo) {
                    stats.estoqueBaixo++;
                }
            });
            
            // Contar vendas de hoje
            const vendasSnapshot = await db.collection('vendas')
                .where('data', '>=', firebase.firestore.Timestamp.fromDate(hoje))
                .where('data', '<', firebase.firestore.Timestamp.fromDate(amanha))
                .get();
            
            stats.vendasHoje = vendasSnapshot.size;
            
            // Calcular faturamento de hoje
            let faturamento = 0;
            vendasSnapshot.forEach(doc => {
                const venda = doc.data();
                faturamento += venda.total || 0;
            });
            stats.faturamentoHoje = faturamento;
            
            // Contar clientes
            const clientesSnapshot = await db.collection('clientes').get();
            stats.totalClientes = clientesSnapshot.size;
            
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
        }
        
        return stats;
    },
    
    // Função para exportar dados
    exportData: async (collectionName) => {
        const snapshot = await db.collection(collectionName).get();
        const data = [];
        
        snapshot.forEach(doc => {
            const item = doc.data();
            // Converter Timestamps para strings
            Object.keys(item).forEach(key => {
                if (item[key] && typeof item[key].toDate === 'function') {
                    item[key] = item[key].toDate().toISOString();
                }
            });
            data.push({
                id: doc.id,
                ...item
            });
        });
        
        return data;
    },
    
    // Função para importar dados
    importData: async (collectionName, data) => {
        const batch = db.batch();
        
        data.forEach(item => {
            const id = item.id || firebaseServices.generateId();
            const ref = db.collection(collectionName).doc(id);
            
            // Converter strings de data para Timestamps
            const cleanItem = { ...item };
            delete cleanItem.id;
            
            Object.keys(cleanItem).forEach(key => {
                if (typeof cleanItem[key] === 'string' && 
                    cleanItem[key].match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
                    cleanItem[key] = firebase.firestore.Timestamp.fromDate(new Date(cleanItem[key]));
                }
            });
            
            cleanItem.criadoEm = cleanItem.criadoEm || firebase.firestore.Timestamp.now();
            cleanItem.atualizadoEm = firebase.firestore.Timestamp.now();
            
            batch.set(ref, cleanItem);
        });
        
        await batch.commit();
    },
    
    // Função para limpar dados
    clearData: async (collectionName) => {
        const snapshot = await db.collection(collectionName).get();
        const batch = db.batch();
        
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
    }
};


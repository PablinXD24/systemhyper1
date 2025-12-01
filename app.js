// Sistema SisLoja - Aplicação Principal
class SisLoja {
    constructor() {
        this.state = {
            user: null,
            moduloAtual: 'dashboard',
            produtos: [],
            clientes: [],
            vendas: [],
            carrinho: [],
            produtoEditando: null,
            clienteEditando: null,
            config: {
                nomeLoja: 'SisLoja J&J',
                estoqueMinimo: 5,
                impostoPadrao: 0
            },
            alertas: []
        };
        
        this.init();
    }

    async init() {
        // Configurar Day.js
        dayjs.locale('pt-br');
        
        // Inicializar autenticação
        this.setupAuth();
        
        // Inicializar eventos
        this.setupEvents();
        
        // Inicializar módulos
        this.setupModules();
        
        // Inicializar relógio
        this.startClock();
        
        // Verificar se está em desenvolvimento
        this.checkDevelopmentMode();
    }

    setupAuth() {
        // Monitorar estado de autenticação
        firebaseServices.auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.state.user = user;
                await this.showMainApp();
                await this.loadUserData();
                await this.loadDashboardData();
            } else {
                this.showLogin();
            }
        });
    }

    setupEvents() {
        // Login
        document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });

        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            firebaseServices.auth.signOut();
        });

        // Navegação
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const modulo = item.getAttribute('data-module');
                this.navigateToModule(modulo);
            });
        });

        // Menu toggle mobile
        document.getElementById('menuToggle')?.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });

        // Fechar menu ao clicar fora (mobile)
        document.addEventListener('click', (e) => {
            const sidebar = document.querySelector('.sidebar');
            const menuToggle = document.getElementById('menuToggle');
            
            if (window.innerWidth <= 1024 && 
                sidebar.classList.contains('active') &&
                !sidebar.contains(e.target) && 
                !menuToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });
    }

    setupModules() {
        // Configurar módulo de produtos
        this.setupProdutosModule();
        
        // Configurar módulo de vendas
        this.setupVendasModule();
        
        // Configurar módulo de clientes
        this.setupClientesModule();
        
        // Configurar módulo de relatórios
        this.setupRelatoriosModule();
        
        // Configurar módulo de códigos de barras
        this.setupCodigosModule();
        
        // Configurar módulo de configurações
        this.setupConfiguracoesModule();
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const userCredential = await firebaseServices.auth.signInWithEmailAndPassword(email, password);
            this.showAlert('Login realizado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro no login:', error);
            
            // Mapear erros do Firebase para mensagens amigáveis
            let errorMessage = 'Erro ao fazer login. ';
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage += 'Email inválido.';
                    break;
                case 'auth/user-disabled':
                    errorMessage += 'Usuário desativado.';
                    break;
                case 'auth/user-not-found':
                    errorMessage += 'Usuário não encontrado.';
                    break;
                case 'auth/wrong-password':
                    errorMessage += 'Senha incorreta.';
                    break;
                default:
                    errorMessage += error.message;
            }
            
            this.showAlert(errorMessage, 'error');
        }
    }

    showLogin() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainContainer').style.display = 'none';
    }

    async showMainApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'flex';
    }

    async loadUserData() {
        if (this.state.user) {
            const displayName = this.state.user.email.split('@')[0];
            document.getElementById('currentUserName').textContent = displayName;
            document.getElementById('sidebarUserName').textContent = displayName;
            document.getElementById('userAvatar').textContent = displayName.charAt(0).toUpperCase();
            
            // Buscar informações adicionais do usuário
            try {
                const userDoc = await firebaseServices.db.collection('usuarios')
                    .doc(this.state.user.email)
                    .get();
                    
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData.nome) {
                        document.getElementById('currentUserName').textContent = userData.nome;
                        document.getElementById('sidebarUserName').textContent = userData.nome;
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar dados do usuário:', error);
            }
        }
    }

    navigateToModule(modulo) {
        // Atualizar navegação
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-module') === modulo) {
                item.classList.add('active');
            }
        });
        
        // Atualizar título
        const titles = {
            'dashboard': '<i class="fas fa-tachometer-alt"></i> Dashboard',
            'produtos': '<i class="fas fa-boxes"></i> Produtos',
            'vendas': '<i class="fas fa-cash-register"></i> Vendas',
            'clientes': '<i class="fas fa-users"></i> Clientes',
            'relatorios': '<i class="fas fa-chart-bar"></i> Relatórios',
            'codigos': '<i class="fas fa-barcode"></i> Códigos de Barras',
            'configuracoes': '<i class="fas fa-cog"></i> Configurações'
        };
        
        document.getElementById('pageTitle').innerHTML = titles[modulo] || titles.dashboard;
        
        // Esconder todos os módulos
        document.querySelectorAll('.module').forEach(mod => {
            mod.style.display = 'none';
        });
        
        // Mostrar módulo selecionado
        document.getElementById(`${modulo}Module`).style.display = 'block';
        this.state.moduloAtual = modulo;
        
        // Carregar dados específicos do módulo
        switch (modulo) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'produtos':
                this.loadProdutos();
                break;
            case 'vendas':
                this.setupPDV();
                break;
            case 'clientes':
                this.loadClientes();
                break;
            case 'relatorios':
                this.setupRelatorios();
                break;
            case 'codigos':
                this.setupBarcodeGenerator();
                break;
            case 'configuracoes':
                this.loadConfiguracoes();
                break;
        }
        
        // Fechar menu mobile se aberto
        if (window.innerWidth <= 1024) {
            document.querySelector('.sidebar').classList.remove('active');
        }
    }

    async loadDashboardData() {
        try {
            // Mostrar loading
            const dashboardModule = document.getElementById('dashboardModule');
            dashboardModule.innerHTML = '<div class="loader"></div>';
            
            // Buscar estatísticas
            const stats = await firebaseServices.getDashboardStats();
            
            // Atualizar cards
            document.getElementById('totalProdutos').textContent = stats.totalProdutos;
            document.getElementById('vendasHoje').textContent = stats.vendasHoje;
            document.getElementById('estoqueBaixo').textContent = stats.estoqueBaixo;
            document.getElementById('totalClientes').textContent = stats.totalClientes;
            
            // Atualizar notificações
            document.getElementById('notificationCount').textContent = stats.estoqueBaixo;
            
            // Carregar vendas recentes
            await this.loadVendasRecentes();
            
            // Carregar produtos mais vendidos
            await this.loadProdutosMaisVendidos();
            
            // Carregar produtos com estoque baixo
            await this.loadProdutosEstoqueBaixo();
            
        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            this.showAlert('Erro ao carregar dashboard: ' + error.message, 'error');
        }
    }

    async loadVendasRecentes() {
        try {
            const vendasSnapshot = await firebaseServices.db.collection('vendas')
                .orderBy('data', 'desc')
                .limit(10)
                .get();
            
            const tbody = document.querySelector('#tabelaVendasRecentes tbody');
            tbody.innerHTML = '';
            
            if (vendasSnapshot.empty) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="empty-state">
                            <i class="fas fa-receipt"></i>
                            <p>Nenhuma venda registrada ainda</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            vendasSnapshot.forEach(doc => {
                const venda = doc.data();
                const data = venda.data.toDate();
                const dataFormatada = dayjs(data).format('DD/MM/YY HH:mm');
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${venda.id || doc.id.substring(0, 8)}</td>
                    <td>${dataFormatada}</td>
                    <td>${venda.clienteNome || 'Consumidor Final'}</td>
                    <td>${venda.itens ? venda.itens.length : 0}</td>
                    <td>R$ ${venda.total ? venda.total.toFixed(2) : '0.00'}</td>
                    <td><span class="status-badge status-success">Finalizada</span></td>
                `;
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Erro ao carregar vendas recentes:', error);
        }
    }

    async loadProdutosMaisVendidos() {
        try {
            const container = document.getElementById('produtosMaisVendidos');
            
            // Buscar todas as vendas dos últimos 30 dias
            const trintaDiasAtras = new Date();
            trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
            
            const vendasSnapshot = await firebaseServices.db.collection('vendas')
                .where('data', '>=', firebase.firestore.Timestamp.fromDate(trintaDiasAtras))
                .get();
            
            // Contar produtos vendidos
            const contagemProdutos = {};
            
            vendasSnapshot.forEach(doc => {
                const venda = doc.data();
                if (venda.itens) {
                    venda.itens.forEach(item => {
                        if (!contagemProdutos[item.produtoId]) {
                            contagemProdutos[item.produtoId] = {
                                quantidade: 0,
                                total: 0,
                                produto: null
                            };
                        }
                        contagemProdutos[item.produtoId].quantidade += item.quantidade;
                        contagemProdutos[item.produtoId].total += item.preco * item.quantidade;
                    });
                }
            });
            
            // Buscar informações dos produtos
            const produtoIds = Object.keys(contagemProdutos);
            if (produtoIds.length === 0) {
                container.innerHTML = '<div class="empty-state">Nenhum produto vendido recentemente</div>';
                return;
            }
            
            for (const produtoId of produtoIds) {
                const produtoDoc = await firebaseServices.db.collection('produtos')
                    .doc(produtoId)
                    .get();
                    
                if (produtoDoc.exists) {
                    contagemProdutos[produtoId].produto = produtoDoc.data();
                }
            }
            
            // Ordenar por quantidade vendida
            const produtosArray = Object.values(contagemProdutos)
                .filter(item => item.produto)
                .sort((a, b) => b.quantidade - a.quantidade)
                .slice(0, 5);
            
            // Exibir produtos
            container.innerHTML = '';
            produtosArray.forEach((item, index) => {
                const produto = item.produto;
                const div = document.createElement('div');
                div.className = 'cart-item';
                div.innerHTML = `
                    <div>
                        <div style="font-weight: 600;">${produto.nome}</div>
                        <div style="font-size: 0.9rem; opacity: 0.7;">${produto.categoria}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600;">${item.quantidade} vendidos</div>
                        <div style="font-size: 0.9rem;">R$ ${item.total.toFixed(2)}</div>
                    </div>
                `;
                container.appendChild(div);
            });
            
        } catch (error) {
            console.error('Erro ao carregar produtos mais vendidos:', error);
            document.getElementById('produtosMaisVendidos').innerHTML = 
                '<div class="alert alert-error">Erro ao carregar dados</div>';
        }
    }

    async loadProdutosEstoqueBaixo() {
        try {
            const produtosSnapshot = await firebaseServices.db.collection('produtos')
                .where('estoque', '<=', firebase.firestore.FieldValue.increment(this.state.config.estoqueMinimo))
                .get();
            
            const tbody = document.querySelector('#tabelaEstoqueBaixo tbody');
            tbody.innerHTML = '';
            
            if (produtosSnapshot.empty) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-state">
                            <i class="fas fa-check-circle"></i>
                            <p>Nenhum produto com estoque baixo</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            produtosSnapshot.forEach(doc => {
                const produto = doc.data();
                const status = produto.estoque === 0 ? 
                    '<span class="status-badge status-danger">ESGOTADO</span>' :
                    '<span class="status-badge status-warning">BAIXO</span>';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${produto.codigo}</td>
                    <td>${produto.nome}</td>
                    <td>${produto.estoque}</td>
                    <td>${produto.estoqueMinimo || this.state.config.estoqueMinimo}</td>
                    <td>${status}</td>
                `;
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Erro ao carregar produtos com estoque baixo:', error);
        }
    }

    showAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `
            <div>${message}</div>
            <button class="close-alert" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        const alertsContainer = document.getElementById('alertsContainer');
        alertsContainer.prepend(alertDiv);
        
        // Remover automaticamente após 5 segundos
        setTimeout(() => {
            if (alertDiv.parentElement) {
                alertDiv.remove();
            }
        }, 5000);
    }

    startClock() {
        function updateClock() {
            const now = new Date();
            const timeString = now.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            const dateString = now.toLocaleDateString('pt-BR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            const clockElement = document.getElementById('currentTime');
            if (clockElement) {
                clockElement.innerHTML = `
                    <div style="font-weight: 600;">${timeString}</div>
                    <div style="font-size: 0.9rem;">${dateString}</div>
                `;
            }
        }
        
        updateClock();
        setInterval(updateClock, 1000);
    }

    checkDevelopmentMode() {
        // Auto-login para desenvolvimento
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(() => {
                if (!this.state.user) {
                    document.getElementById('loginEmail').value = 'admin@jj.com';
                    document.getElementById('loginPassword').value = 'J&J2024';
                    document.getElementById('loginForm').dispatchEvent(new Event('submit'));
                }
            }, 1000);
        }
    }

    // Módulo de Produtos
    setupProdutosModule() {
        const btnNovoProduto = document.getElementById('btnNovoProduto');
        const btnExportarProdutos = document.getElementById('btnExportarProdutos');
        const buscaProduto = document.getElementById('buscaProduto');
        const filtroCategoria = document.getElementById('filtroCategoria');
        
        if (btnNovoProduto) {
            btnNovoProduto.addEventListener('click', () => this.openProdutoModal());
        }
        
        if (btnExportarProdutos) {
            btnExportarProdutos.addEventListener('click', () => this.exportarProdutos());
        }
        
        if (buscaProduto) {
            buscaProduto.addEventListener('input', () => this.filtrarProdutos());
        }
        
        if (filtroCategoria) {
            filtroCategoria.addEventListener('change', () => this.filtrarProdutos());
        }
    }

    async loadProdutos() {
        try {
            const produtosSnapshot = await firebaseServices.db.collection('produtos')
                .orderBy('nome')
                .get();
            
            this.state.produtos = [];
            const tbody = document.querySelector('#tabelaProdutos tbody');
            tbody.innerHTML = '';
            
            produtosSnapshot.forEach(doc => {
                const produto = {
                    id: doc.id,
                    ...doc.data()
                };
                this.state.produtos.push(produto);
                
                this.renderProdutoRow(produto, tbody);
            });
            
            if (produtosSnapshot.empty) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="empty-state">
                            <i class="fas fa-box-open"></i>
                            <p>Nenhum produto cadastrado</p>
                        </td>
                    </tr>
                `;
            }
            
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
            this.showAlert('Erro ao carregar produtos: ' + error.message, 'error');
        }
    }

    renderProdutoRow(produto, tbody) {
        // Determinar cor do estoque
        let estoqueClass = '';
        let statusBadge = '';
        
        if (produto.estoque === 0) {
            estoqueClass = 'text-danger';
            statusBadge = '<span class="status-badge status-danger">ESGOTADO</span>';
        } else if (produto.estoque <= (produto.estoqueMinimo || this.state.config.estoqueMinimo)) {
            estoqueClass = 'text-warning';
            statusBadge = '<span class="status-badge status-warning">BAIXO</span>';
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${produto.codigo}</td>
            <td>
                <div style="font-weight: 600;">${produto.nome}</div>
                <div style="font-size: 0.9rem; opacity: 0.7;">${produto.descricao || ''}</div>
            </td>
            <td>${produto.categoria}</td>
            <td>R$ ${produto.precoVenda?.toFixed(2) || '0.00'}</td>
            <td class="${estoqueClass}">
                <div>${produto.estoque} ${produto.unidade || 'UN'}</div>
                ${statusBadge}
            </td>
            <td class="actions">
                <button class="btn-icon edit" onclick="sisloja.editProduto('${produto.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon delete" onclick="sisloja.deleteProduto('${produto.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    }

    openProdutoModal(produtoId = null) {
        const modal = document.getElementById('modalProduto');
        const titulo = document.getElementById('modalProdutoTitulo');
        
        // Configurar eventos dos botões do modal
        document.getElementById('fecharModalProduto').onclick = () => this.closeProdutoModal();
        document.getElementById('cancelarProduto').onclick = () => this.closeProdutoModal();
        document.getElementById('btnGerarCodigoProduto').onclick = () => this.gerarCodigoBarrasProduto();
        document.getElementById('btnValidarCodigoProduto').onclick = () => this.validarCodigoBarrasProduto();
        
        // Configurar formulário
        document.getElementById('formProduto').onsubmit = (e) => this.salvarProduto(e);
        
        if (produtoId) {
            // Modo edição
            titulo.textContent = 'Editar Produto';
            this.state.produtoEditando = produtoId;
            
            // Carregar dados do produto
            firebaseServices.db.collection('produtos')
                .doc(produtoId)
                .get()
                .then(doc => {
                    if (doc.exists) {
                        const produto = doc.data();
                        this.preencherFormProduto(produto);
                    }
                })
                .catch(error => {
                    console.error('Erro ao carregar produto:', error);
                    this.showAlert('Erro ao carregar produto: ' + error.message, 'error');
                });
        } else {
            // Modo criação
            titulo.textContent = 'Novo Produto';
            this.state.produtoEditando = null;
            
            // Limpar formulário
            document.getElementById('formProduto').reset();
            
            // Gerar código automático
            this.gerarCodigoProduto();
        }
        
        modal.classList.add('active');
    }

    preencherFormProduto(produto) {
        document.getElementById('produtoCodigo').value = produto.codigo || '';
        document.getElementById('produtoNome').value = produto.nome || '';
        document.getElementById('produtoDescricao').value = produto.descricao || '';
        document.getElementById('produtoCategoria').value = produto.categoria || 'Alimentos';
        document.getElementById('produtoUnidade').value = produto.unidade || 'UN';
        document.getElementById('produtoPrecoCusto').value = produto.precoCusto || '';
        document.getElementById('produtoPrecoVenda').value = produto.precoVenda || '';
        document.getElementById('produtoEstoque').value = produto.estoque || '';
        document.getElementById('produtoEstoqueMinimo').value = produto.estoqueMinimo || this.state.config.estoqueMinimo;
        document.getElementById('produtoCodigoBarras').value = produto.codigoBarras || '';
        document.getElementById('produtoFornecedor').value = produto.fornecedor || '';
        
        // Atualizar preview do código de barras
        if (produto.codigoBarras) {
            this.atualizarBarcodePreview(produto.codigoBarras);
        }
    }

    gerarCodigoProduto() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        const code = 'P' + timestamp.toString().slice(-8) + random.toString().padStart(3, '0');
        document.getElementById('produtoCodigo').value = code;
    }

    gerarCodigoBarrasProduto() {
        const codigo = document.getElementById('produtoCodigo').value;
        if (!codigo) {
            this.showAlert('Digite um código para o produto primeiro', 'warning');
            return;
        }
        
        // Gerar código EAN-13 válido
        let baseCodigo = codigo.replace(/\D/g, '');
        if (baseCodigo.length > 12) {
            baseCodigo = baseCodigo.substring(0, 12);
        } else if (baseCodigo.length < 12) {
            baseCodigo = baseCodigo.padStart(12, '0');
        }
        
        const digitoVerificador = this.calcularDigitoVerificadorEAN(baseCodigo);
        const codigoCompleto = baseCodigo + digitoVerificador;
        
        document.getElementById('produtoCodigoBarras').value = codigoCompleto;
        this.atualizarBarcodePreview(codigoCompleto);
    }

    atualizarBarcodePreview(codigo) {
        const previewDiv = document.getElementById('barcodePreview');
        previewDiv.innerHTML = '';
        
        try {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            JsBarcode(svg, codigo, {
                format: 'EAN13',
                width: 2,
                height: 50,
                displayValue: true
            });
            previewDiv.appendChild(svg);
        } catch (error) {
            previewDiv.innerHTML = `<div class="alert alert-error">Erro ao gerar preview: ${error.message}</div>`;
        }
    }

    calcularDigitoVerificadorEAN(codigo) {
        let soma = 0;
        for (let i = 0; i < codigo.length; i++) {
            const digito = parseInt(codigo[i]);
            soma += (i % 2 === 0) ? digito : digito * 3;
        }
        const resto = soma % 10;
        return resto === 0 ? 0 : 10 - resto;
    }

    validarCodigoBarrasProduto() {
        const codigo = document.getElementById('produtoCodigoBarras').value.trim();
        
        if (!codigo) {
            this.showAlert('Digite um código de barras para validar', 'warning');
            return;
        }
        
        if (codigo.length === 13) {
            const baseCodigo = codigo.substring(0, 12);
            const digitoVerificador = parseInt(codigo[12]);
            const digitoCalculado = this.calcularDigitoVerificadorEAN(baseCodigo);
            
            if (digitoVerificador === digitoCalculado) {
                this.showAlert('Código EAN-13 válido!', 'success');
            } else {
                this.showAlert(`Código inválido. Dígito correto: ${digitoCalculado}`, 'error');
            }
        } else {
            this.showAlert('Código deve ter 13 dígitos para EAN-13', 'warning');
        }
    }

    async salvarProduto(e) {
        e.preventDefault();
        
        const produto = {
            codigo: document.getElementById('produtoCodigo').value,
            nome: document.getElementById('produtoNome').value,
            descricao: document.getElementById('produtoDescricao').value,
            categoria: document.getElementById('produtoCategoria').value,
            unidade: document.getElementById('produtoUnidade').value,
            precoCusto: parseFloat(document.getElementById('produtoPrecoCusto').value) || 0,
            precoVenda: parseFloat(document.getElementById('produtoPrecoVenda').value),
            estoque: parseInt(document.getElementById('produtoEstoque').value),
            estoqueMinimo: parseInt(document.getElementById('produtoEstoqueMinimo').value) || this.state.config.estoqueMinimo,
            codigoBarras: document.getElementById('produtoCodigoBarras').value || null,
            fornecedor: document.getElementById('produtoFornecedor').value || null,
            atualizadoEm: new Date()
        };
        
        // Validações
        if (!produto.codigo || !produto.nome || !produto.precoVenda || isNaN(produto.estoque)) {
            this.showAlert('Preencha todos os campos obrigatórios (*)', 'error');
            return;
        }
        
        if (produto.precoVenda <= 0) {
            this.showAlert('Preço de venda deve ser maior que zero', 'error');
            return;
        }
        
        if (produto.estoque < 0) {
            this.showAlert('Estoque não pode ser negativo', 'error');
            return;
        }
        
        try {
            if (this.state.produtoEditando) {
                // Atualizar produto existente
                await firebaseServices.db.collection('produtos')
                    .doc(this.state.produtoEditando)
                    .update(produto);
                    
                this.showAlert('Produto atualizado com sucesso!', 'success');
            } else {
                // Criar novo produto
                produto.criadoEm = new Date();
                await firebaseServices.db.collection('produtos')
                    .add(produto);
                    
                this.showAlert('Produto criado com sucesso!', 'success');
            }
            
            // Fechar modal e atualizar dados
            this.closeProdutoModal();
            await this.loadProdutos();
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Erro ao salvar produto:', error);
            this.showAlert('Erro ao salvar produto: ' + error.message, 'error');
        }
    }

    closeProdutoModal() {
        document.getElementById('modalProduto').classList.remove('active');
        this.state.produtoEditando = null;
    }

    editProduto(produtoId) {
        this.openProdutoModal(produtoId);
    }

    async deleteProduto(produtoId) {
        if (!confirm('Tem certeza que deseja excluir este produto?')) {
            return;
        }
        
        try {
            // Verificar se o produto está em vendas
            const vendasSnapshot = await firebaseServices.db.collection('vendas')
                .where('itens', 'array-contains', firebase.firestore.FieldPath.documentId())
                .get();
            
            let produtoEmVenda = false;
            vendasSnapshot.forEach(doc => {
                const venda = doc.data();
                if (venda.itens?.some(item => item.produtoId === produtoId)) {
                    produtoEmVenda = true;
                }
            });
            
            if (produtoEmVenda) {
                this.showAlert('Este produto não pode ser excluído porque está em vendas registradas', 'warning');
                return;
            }
            
            // Excluir produto
            await firebaseServices.db.collection('produtos')
                .doc(produtoId)
                .delete();
                
            this.showAlert('Produto excluído com sucesso!', 'success');
            
            // Atualizar dados
            await this.loadProdutos();
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Erro ao excluir produto:', error);
            this.showAlert('Erro ao excluir produto: ' + error.message, 'error');
        }
    }

    async filtrarProdutos() {
        const busca = document.getElementById('buscaProduto').value.toLowerCase();
        const categoria = document.getElementById('filtroCategoria').value;
        
        const produtosFiltrados = this.state.produtos.filter(produto => {
            const matchBusca = !busca || 
                produto.nome.toLowerCase().includes(busca) ||
                produto.codigo.toLowerCase().includes(busca) ||
                (produto.descricao && produto.descricao.toLowerCase().includes(busca)) ||
                (produto.codigoBarras && produto.codigoBarras.includes(busca));
            
            const matchCategoria = !categoria || produto.categoria === categoria;
            
            return matchBusca && matchCategoria;
        });
        
        const tbody = document.querySelector('#tabelaProdutos tbody');
        tbody.innerHTML = '';
        
        if (produtosFiltrados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-search"></i>
                        <p>Nenhum produto encontrado</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        produtosFiltrados.forEach(produto => {
            this.renderProdutoRow(produto, tbody);
        });
    }

    async exportarProdutos() {
        try {
            const produtos = await firebaseServices.exportData('produtos');
            
            const dados = JSON.stringify(produtos, null, 2);
            const blob = new Blob([dados], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `produtos_sisloja_${dayjs().format('YYYY-MM-DD')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            this.showAlert('Produtos exportados com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao exportar produtos:', error);
            this.showAlert('Erro ao exportar produtos: ' + error.message, 'error');
        }
    }

    // Módulo de Vendas
    setupVendasModule() {
        // Botões principais
        document.getElementById('btnNovaVenda').addEventListener('click', () => {
            this.navigateToModule('vendas');
        });
        
        document.getElementById('btnFinalizarVenda').addEventListener('click', () => {
            this.finalizarVenda();
        });
        
        document.getElementById('btnCancelarVenda').addEventListener('click', () => {
            this.cancelarVenda();
        });
        
        // Configurar filtro de histórico
        document.getElementById('btnFiltrarVendas').addEventListener('click', () => {
            this.carregarHistoricoVendas();
        });
        
        // Configurar data padrão para hoje
        const hoje = dayjs().format('YYYY-MM-DD');
        document.getElementById('dataInicio').value = hoje;
        document.getElementById('dataFim').value = hoje;
    }

    setupPDV() {
        // Limpar carrinho
        this.state.carrinho = [];
        this.atualizarCarrinhoVenda();
        
        // Configurar campo de código de barras
        const barcodeInput = document.getElementById('codigoBarrasInput');
        barcodeInput.value = '';
        barcodeInput.focus();
        
        barcodeInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const code = barcodeInput.value.trim();
                if (code) {
                    await this.adicionarProdutoAoCarrinho(code);
                    barcodeInput.value = '';
                    barcodeInput.focus();
                }
            }
        });
        
        // Configurar cálculos
        document.getElementById('descontoVenda').addEventListener('input', () => this.calcularTotaisVenda());
        document.getElementById('acrescimoVenda').addEventListener('input', () => this.calcularTotaisVenda());
        document.getElementById('valorRecebido').addEventListener('input', () => this.calcularTotaisVenda());
        
        // Carregar clientes para venda
        this.carregarClientesParaVenda();
        
        // Carregar produtos sugeridos
        this.carregarProdutosSugeridos();
        
        // Carregar histórico
        this.carregarHistoricoVendas();
    }

    async adicionarProdutoAoCarrinho(codigo) {
        try {
            // Buscar produto
            let produto = null;
            let produtoId = null;
            
            // Buscar por código
            let snapshot = await firebaseServices.db.collection('produtos')
                .where('codigo', '==', codigo)
                .limit(1)
                .get();
            
            if (!snapshot.empty) {
                produto = snapshot.docs[0].data();
                produtoId = snapshot.docs[0].id;
            } else {
                // Buscar por código de barras
                snapshot = await firebaseServices.db.collection('produtos')
                    .where('codigoBarras', '==', codigo)
                    .limit(1)
                    .get();
                
                if (!snapshot.empty) {
                    produto = snapshot.docs[0].data();
                    produtoId = snapshot.docs[0].id;
                }
            }
            
            if (!produto) {
                this.showAlert('Produto não encontrado!', 'error');
                return;
            }
            
            if (produto.estoque <= 0) {
                this.showAlert(`Produto "${produto.nome}" sem estoque!`, 'error');
                return;
            }
            
            // Verificar se já está no carrinho
            const itemIndex = this.state.carrinho.findIndex(item => item.produtoId === produtoId);
            
            if (itemIndex !== -1) {
                // Incrementar quantidade
                this.state.carrinho[itemIndex].quantidade++;
            } else {
                // Adicionar novo item
                this.state.carrinho.push({
                    produtoId: produtoId,
                    codigo: produto.codigo,
                    nome: produto.nome,
                    preco: produto.precoVenda,
                    quantidade: 1
                });
            }
            
            this.atualizarCarrinhoVenda();
            this.showAlert(`${produto.nome} adicionado ao carrinho!`, 'success');
            
        } catch (error) {
            console.error('Erro ao adicionar produto:', error);
            this.showAlert('Erro ao adicionar produto ao carrinho: ' + error.message, 'error');
        }
    }

    atualizarCarrinhoVenda() {
        const container = document.getElementById('carrinhoVenda');
        container.innerHTML = '';
        
        if (this.state.carrinho.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-dark); opacity: 0.5;">
                    <i class="fas fa-shopping-cart" style="font-size: 3rem; margin-bottom: 20px;"></i>
                    <p style="font-size: 1.2rem; font-weight: 600;">Carrinho vazio</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">
                        Passe o código de barras ou digite o código do produto
                    </p>
                </div>
            `;
            return;
        }
        
        let subtotal = 0;
        
        this.state.carrinho.forEach((item, index) => {
            const itemTotal = item.preco * item.quantidade;
            subtotal += itemTotal;
            
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 5px;">${item.nome}</div>
                    <div style="font-size: 0.9rem; opacity: 0.7;">Código: ${item.codigo}</div>
                </div>
                <div style="text-align: right; min-width: 150px;">
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 15px; margin-bottom: 10px;">
                        <button onclick="sisloja.alterarQuantidadeCarrinho(${index}, -1)" 
                                style="width: 30px; height: 30px; border-radius: 8px; border: none; background: var(--glass-red); color: white; cursor: pointer; font-weight: bold;">-</button>
                        <span style="min-width: 30px; text-align: center; font-weight: 600;">${item.quantidade}</span>
                        <button onclick="sisloja.alterarQuantidadeCarrinho(${index}, 1)" 
                                style="width: 30px; height: 30px; border-radius: 8px; border: none; background: var(--glass-red); color: white; cursor: pointer; font-weight: bold;">+</button>
                    </div>
                    <div style="font-weight: 600; font-size: 1.1rem;">R$ ${itemTotal.toFixed(2)}</div>
                    <div style="font-size: 0.9rem; opacity: 0.7;">R$ ${item.preco.toFixed(2)} cada</div>
                    <button onclick="sisloja.removerDoCarrinho(${index})" 
                            style="background: none; border: none; color: var(--danger-red); cursor: pointer; font-size: 0.9rem; margin-top: 10px;">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
        
        document.getElementById('totalVenda').textContent = subtotal.toFixed(2);
        this.calcularTotaisVenda();
    }

    alterarQuantidadeCarrinho(index, delta) {
        const novaQuantidade = this.state.carrinho[index].quantidade + delta;
        
        if (novaQuantidade < 1) {
            this.removerDoCarrinho(index);
            return;
        }
        
        this.state.carrinho[index].quantidade = novaQuantidade;
        this.atualizarCarrinhoVenda();
    }

    removerDoCarrinho(index) {
        this.state.carrinho.splice(index, 1);
        this.atualizarCarrinhoVenda();
        
        if (this.state.carrinho.length === 0) {
            this.showAlert('Carrinho limpo.', 'info');
        }
    }

    calcularTotaisVenda() {
        // Calcular subtotal
        const subtotal = this.state.carrinho.reduce((total, item) => {
            return total + (item.preco * item.quantidade);
        }, 0);
        
        // Obter desconto e acréscimo
        const desconto = parseFloat(document.getElementById('descontoVenda').value) || 0;
        const acrescimo = parseFloat(document.getElementById('acrescimoVenda').value) || 0;
        
        // Calcular total
        const total = subtotal - desconto + acrescimo;
        
        // Obter valor recebido
        const valorRecebido = parseFloat(document.getElementById('valorRecebido').value) || 0;
        const troco = Math.max(0, valorRecebido - total);
        
        // Atualizar campos
        document.getElementById('subtotalVenda').value = `R$ ${subtotal.toFixed(2)}`;
        document.getElementById('totalFinalVenda').value = `R$ ${total.toFixed(2)}`;
        document.getElementById('trocoVenda').value = `R$ ${troco.toFixed(2)}`;
        document.getElementById('totalVenda').textContent = total.toFixed(2);
    }

    async carregarClientesParaVenda() {
        try {
            const snapshot = await firebaseServices.db.collection('clientes')
                .orderBy('nome')
                .get();
            
            const select = document.getElementById('clienteVenda');
            
            // Manter primeira opção
            select.innerHTML = '<option value="">Consumidor Final</option>';
            
            snapshot.forEach(doc => {
                const cliente = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = cliente.nome;
                select.appendChild(option);
            });
            
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
        }
    }

    async carregarProdutosSugeridos() {
        try {
            const container = document.getElementById('produtosSugeridos');
            
            // Buscar produtos com estoque
            const snapshot = await firebaseServices.db.collection('produtos')
                .where('estoque', '>', 0)
                .orderBy('estoque', 'desc')
                .limit(6)
                .get();
            
            container.innerHTML = '';
            
            if (snapshot.empty) {
                container.innerHTML = '<div class="empty-state">Nenhum produto em estoque</div>';
                return;
            }
            
            snapshot.forEach(doc => {
                const produto = doc.data();
                const div = document.createElement('div');
                div.className = 'cart-item';
                div.style.cursor = 'pointer';
                div.onclick = () => {
                    document.getElementById('codigoBarrasInput').value = produto.codigo;
                    document.getElementById('codigoBarrasInput').focus();
                    document.getElementById('codigoBarrasInput').dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
                };
                
                div.innerHTML = `
                    <div>
                        <div style="font-weight: 600;">${produto.nome}</div>
                        <div style="font-size: 0.9rem; opacity: 0.7;">Estoque: ${produto.estoque}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600;">R$ ${produto.precoVenda?.toFixed(2) || '0.00'}</div>
                        <div style="font-size: 0.9rem; opacity: 0.7;">${produto.codigo}</div>
                    </div>
                `;
                container.appendChild(div);
            });
            
        } catch (error) {
            console.error('Erro ao carregar produtos sugeridos:', error);
        }
    }

    async finalizarVenda() {
        if (this.state.carrinho.length === 0) {
            this.showAlert('Adicione produtos ao carrinho antes de finalizar a venda.', 'error');
            return;
        }
        
        // Calcular valores
        const subtotal = this.state.carrinho.reduce((total, item) => {
            return total + (item.preco * item.quantidade);
        }, 0);
        
        const desconto = parseFloat(document.getElementById('descontoVenda').value) || 0;
        const acrescimo = parseFloat(document.getElementById('acrescimoVenda').value) || 0;
        const total = subtotal - desconto + acrescimo;
        
        const formaPagamento = document.getElementById('formaPagamento').value;
        const clienteId = document.getElementById('clienteVenda').value;
        const valorRecebido = parseFloat(document.getElementById('valorRecebido').value) || 0;
        
        // Validar pagamento em dinheiro
        if (formaPagamento === 'Dinheiro' && valorRecebido < total) {
            this.showAlert('Valor recebido é menor que o total da venda.', 'error');
            return;
        }
        
        // Confirmar venda
        if (!confirm(`Confirmar venda no valor de R$ ${total.toFixed(2)}?`)) {
            return;
        }
        
        try {
            // Buscar nome do cliente
            let clienteNome = 'Consumidor Final';
            if (clienteId) {
                const clienteDoc = await firebaseServices.db.collection('clientes')
                    .doc(clienteId)
                    .get();
                    
                if (clienteDoc.exists) {
                    clienteNome = clienteDoc.data().nome;
                }
            }
            
            // Criar objeto da venda
            const venda = {
                itens: this.state.carrinho.map(item => ({
                    produtoId: item.produtoId,
                    codigo: item.codigo,
                    nome: item.nome,
                    preco: item.preco,
                    quantidade: item.quantidade,
                    total: item.preco * item.quantidade
                })),
                subtotal: subtotal,
                desconto: desconto,
                acrescimo: acrescimo,
                total: total,
                formaPagamento: formaPagamento,
                valorRecebido: valorRecebido,
                troco: Math.max(0, valorRecebido - total),
                clienteId: clienteId || null,
                clienteNome: clienteNome,
                vendedor: this.state.user.email,
                data: new Date(),
                status: 'finalizada'
            };
            
            // Salvar venda no Firestore
            const vendaRef = await firebaseServices.db.collection('vendas').add(venda);
            
            // Atualizar estoque dos produtos
            for (const item of this.state.carrinho) {
                const produtoRef = firebaseServices.db.collection('produtos').doc(item.produtoId);
                
                await produtoRef.update({
                    estoque: firebase.firestore.FieldValue.increment(-item.quantidade),
                    atualizadoEm: new Date()
                });
            }
            
            // Atualizar cliente (se houver)
            if (clienteId) {
                await firebaseServices.db.collection('clientes').doc(clienteId).update({
                    ultimaCompra: new Date(),
                    totalCompras: firebase.firestore.FieldValue.increment(total)
                });
            }
            
            // Limpar carrinho
            this.state.carrinho = [];
            
            // Limpar formulário
            document.getElementById('descontoVenda').value = '0.00';
            document.getElementById('acrescimoVenda').value = '0.00';
            document.getElementById('valorRecebido').value = '0.00';
            document.getElementById('codigoBarrasInput').value = '';
            document.getElementById('codigoBarrasInput').focus();
            
            // Atualizar interface
            this.atualizarCarrinhoVenda();
            
            // Mostrar recibo
            await this.gerarRecibo(vendaRef.id, venda);
            
            // Mostrar mensagem de sucesso
            this.showAlert(`Venda #${vendaRef.id.substring(0, 8)} finalizada com sucesso!`, 'success');
            
            // Atualizar dados
            await this.carregarHistoricoVendas();
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Erro ao finalizar venda:', error);
            this.showAlert('Erro ao finalizar venda: ' + error.message, 'error');
        }
    }

    cancelarVenda() {
        if (this.state.carrinho.length === 0) {
            this.showAlert('Não há venda em andamento.', 'info');
            return;
        }
        
        if (!confirm('Deseja cancelar esta venda?')) {
            return;
        }
        
        this.state.carrinho = [];
        this.atualizarCarrinhoVenda();
        
        document.getElementById('descontoVenda').value = '0.00';
        document.getElementById('acrescimoVenda').value = '0.00';
        document.getElementById('valorRecebido').value = '0.00';
        document.getElementById('codigoBarrasInput').value = '';
        document.getElementById('codigoBarrasInput').focus();
        
        this.showAlert('Venda cancelada.', 'info');
    }

    async carregarHistoricoVendas() {
        try {
            const dataInicio = document.getElementById('dataInicio').value;
            const dataFim = document.getElementById('dataFim').value;
            
            let query = firebaseServices.db.collection('vendas')
                .orderBy('data', 'desc')
                .limit(50);
            
            // Aplicar filtro de data se fornecido
            if (dataInicio) {
                const inicio = new Date(dataInicio);
                inicio.setHours(0, 0, 0, 0);
                query = query.where('data', '>=', firebase.firestore.Timestamp.fromDate(inicio));
            }
            
            if (dataFim) {
                const fim = new Date(dataFim);
                fim.setHours(23, 59, 59, 999);
                query = query.where('data', '<=', firebase.firestore.Timestamp.fromDate(fim));
            }
            
            const snapshot = await query.get();
            const tbody = document.querySelector('#tabelaHistoricoVendas tbody');
            tbody.innerHTML = '';
            
            if (snapshot.empty) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="empty-state">
                            <i class="fas fa-receipt"></i>
                            <p>Nenhuma venda encontrada</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            snapshot.forEach(doc => {
                const venda = doc.data();
                const data = venda.data.toDate();
                const dataFormatada = dayjs(data).format('DD/MM/YY HH:mm');
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${doc.id.substring(0, 8)}</td>
                    <td>${dataFormatada}</td>
                    <td>${venda.clienteNome || 'Consumidor Final'}</td>
                    <td>${venda.itens.length}</td>
                    <td>R$ ${venda.total.toFixed(2)}</td>
                    <td>${venda.formaPagamento}</td>
                    <td class="actions">
                        <button class="btn-icon view" onclick="sisloja.imprimirRecibo('${doc.id}')">
                            <i class="fas fa-print"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Erro ao carregar histórico de vendas:', error);
            this.showAlert('Erro ao carregar histórico: ' + error.message, 'error');
        }
    }

    async gerarRecibo(vendaId, vendaData = null) {
        try {
            let venda = vendaData;
            
            if (!venda) {
                // Buscar venda pelo ID
                const vendaDoc = await firebaseServices.db.collection('vendas').doc(vendaId).get();
                if (!vendaDoc.exists) {
                    this.showAlert('Venda não encontrada', 'error');
                    return;
                }
                venda = vendaDoc.data();
            }
            
            // Preencher dados do recibo
            document.getElementById('reciboNomeLoja').textContent = this.state.config.nomeLoja;
            document.getElementById('reciboId').textContent = vendaId.substring(0, 8);
            document.getElementById('reciboData').textContent = dayjs(venda.data.toDate()).format('DD/MM/YYYY HH:mm:ss');
            document.getElementById('reciboCliente').textContent = venda.clienteNome;
            document.getElementById('reciboVendedor').textContent = venda.vendedor || 'Sistema';
            document.getElementById('reciboSubtotal').textContent = venda.subtotal.toFixed(2);
            document.getElementById('reciboDesconto').textContent = venda.desconto.toFixed(2);
            document.getElementById('reciboAcrescimo').textContent = venda.acrescimo.toFixed(2);
            document.getElementById('reciboTotal').textContent = venda.total.toFixed(2);
            document.getElementById('reciboPagamento').textContent = venda.formaPagamento;
            document.getElementById('reciboRecebido').textContent = venda.valorRecebido.toFixed(2);
            document.getElementById('reciboTroco').textContent = venda.troco.toFixed(2);
            
            // Preencher itens
            const tbody = document.getElementById('reciboItens');
            tbody.innerHTML = '';
            
            venda.itens.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.nome}</td>
                    <td>${item.quantidade}</td>
                    <td>R$ ${item.preco.toFixed(2)}</td>
                    <td>R$ ${(item.preco * item.quantidade).toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
            
            // Imprimir recibo
            const reciboConteudo = document.getElementById('reciboContainer').innerHTML;
            const janela = window.open('', '_blank');
            
            janela.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Recibo de Venda - ${vendaId}</title>
                    <style>
                        body { 
                            font-family: 'Courier New', monospace; 
                            margin: 0; 
                            padding: 10px;
                            font-size: 14px;
                            width: 80mm;
                        }
                        .recibo { 
                            background: white;
                            padding: 20px;
                        }
                        .recibo-header {
                            text-align: center;
                            margin-bottom: 15px;
                            border-bottom: 2px dashed #000;
                            padding-bottom: 10px;
                        }
                        .recibo-header h2 {
                            font-size: 18px;
                            margin: 0;
                            font-weight: bold;
                        }
                        .recibo-info {
                            margin-bottom: 15px;
                        }
                        .recibo-itens {
                            width: 100%;
                            margin: 15px 0;
                            border-collapse: collapse;
                        }
                        .recibo-itens th,
                        .recibo-itens td {
                            padding: 5px;
                            border-bottom: 1px dashed #ccc;
                            text-align: center;
                        }
                        .recibo-totais {
                            border-top: 2px dashed #000;
                            padding-top: 15px;
                            margin-top: 15px;
                        }
                        .recibo-footer {
                            text-align: center;
                            margin-top: 20px;
                            border-top: 2px dashed #000;
                            padding-top: 15px;
                        }
                        .assinatura {
                            margin-top: 30px;
                        }
                        @media print {
                            body { margin: 0; padding: 0; }
                            .recibo { border: none; }
                        }
                    </style>
                </head>
                <body>
                    ${reciboConteudo}
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() {
                                window.close();
                            }, 1000);
                        };
                    <\/script>
                </body>
                </html>
            `);
            
            janela.document.close();
            
        } catch (error) {
            console.error('Erro ao gerar recibo:', error);
            this.showAlert('Erro ao gerar recibo: ' + error.message, 'error');
        }
    }

    // Módulo de Clientes
    setupClientesModule() {
        document.getElementById('btnNovoCliente').addEventListener('click', () => {
            this.openClienteModal();
        });
        
        document.getElementById('btnExportarClientes').addEventListener('click', () => {
            this.exportarClientes();
        });
        
        document.getElementById('buscaCliente').addEventListener('input', () => {
            this.filtrarClientes();
        });
    }

    async loadClientes() {
        try {
            const snapshot = await firebaseServices.db.collection('clientes')
                .orderBy('nome')
                .get();
            
            this.state.clientes = [];
            const tbody = document.querySelector('#tabelaClientes tbody');
            tbody.innerHTML = '';
            
            snapshot.forEach(doc => {
                const cliente = {
                    id: doc.id,
                    ...doc.data()
                };
                this.state.clientes.push(cliente);
                
                this.renderClienteRow(cliente, tbody);
            });
            
            if (snapshot.empty) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="empty-state">
                            <i class="fas fa-users"></i>
                            <p>Nenhum cliente cadastrado</p>
                        </td>
                    </tr>
                `;
            }
            
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            this.showAlert('Erro ao carregar clientes: ' + error.message, 'error');
        }
    }

    renderClienteRow(cliente, tbody) {
        const ultimaCompra = cliente.ultimaCompra ? 
            dayjs(cliente.ultimaCompra.toDate()).format('DD/MM/YY') : 
            'Nunca';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${cliente.id.substring(0, 8)}</td>
            <td>
                <div style="font-weight: 600;">${cliente.nome}</div>
                <div style="font-size: 0.9rem; opacity: 0.7;">${cliente.cpfCnpj || ''}</div>
            </td>
            <td>${cliente.telefone}</td>
            <td>${cliente.email || '-'}</td>
            <td>R$ ${cliente.totalCompras?.toFixed(2) || '0.00'}</td>
            <td>${ultimaCompra}</td>
            <td class="actions">
                <button class="btn-icon edit" onclick="sisloja.editCliente('${cliente.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon delete" onclick="sisloja.deleteCliente('${cliente.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    }

    openClienteModal(clienteId = null) {
        const modal = document.getElementById('modalCliente');
        const titulo = document.getElementById('modalClienteTitulo');
        
        // Configurar eventos
        document.getElementById('fecharModalCliente').onclick = () => this.closeClienteModal();
        document.getElementById('cancelarCliente').onclick = () => this.closeClienteModal();
        document.getElementById('formCliente').onsubmit = (e) => this.salvarCliente(e);
        
        if (clienteId) {
            titulo.textContent = 'Editar Cliente';
            this.state.clienteEditando = clienteId;
            
            // Carregar dados do cliente
            firebaseServices.db.collection('clientes')
                .doc(clienteId)
                .get()
                .then(doc => {
                    if (doc.exists) {
                        const cliente = doc.data();
                        this.preencherFormCliente(cliente);
                    }
                });
        } else {
            titulo.textContent = 'Novo Cliente';
            this.state.clienteEditando = null;
            document.getElementById('formCliente').reset();
        }
        
        modal.classList.add('active');
    }

    preencherFormCliente(cliente) {
        document.getElementById('clienteNome').value = cliente.nome || '';
        document.getElementById('clienteCpfCnpj').value = cliente.cpfCnpj || '';
        document.getElementById('clienteTelefone').value = cliente.telefone || '';
        document.getElementById('clienteEmail').value = cliente.email || '';
        document.getElementById('clienteEndereco').value = cliente.endereco || '';
        document.getElementById('clienteCidade').value = cliente.cidade || '';
        document.getElementById('clienteEstado').value = cliente.estado || '';
        document.getElementById('clienteCep').value = cliente.cep || '';
        document.getElementById('clienteObservacoes').value = cliente.observacoes || '';
    }

    async salvarCliente(e) {
        e.preventDefault();
        
        const cliente = {
            nome: document.getElementById('clienteNome').value,
            cpfCnpj: document.getElementById('clienteCpfCnpj').value || null,
            telefone: document.getElementById('clienteTelefone').value,
            email: document.getElementById('clienteEmail').value || null,
            endereco: document.getElementById('clienteEndereco').value || null,
            cidade: document.getElementById('clienteCidade').value || null,
            estado: document.getElementById('clienteEstado').value || null,
            cep: document.getElementById('clienteCep').value || null,
            observacoes: document.getElementById('clienteObservacoes').value || null,
            atualizadoEm: new Date()
        };
        
        // Validações
        if (!cliente.nome || !cliente.telefone) {
            this.showAlert('Preencha nome e telefone', 'error');
            return;
        }
        
        try {
            if (this.state.clienteEditando) {
                // Atualizar cliente existente
                await firebaseServices.db.collection('clientes')
                    .doc(this.state.clienteEditando)
                    .update(cliente);
                    
                this.showAlert('Cliente atualizado com sucesso!', 'success');
            } else {
                // Criar novo cliente
                cliente.criadoEm = new Date();
                cliente.totalCompras = 0;
                
                await firebaseServices.db.collection('clientes')
                    .add(cliente);
                    
                this.showAlert('Cliente criado com sucesso!', 'success');
            }
            
            // Fechar modal e atualizar dados
            this.closeClienteModal();
            await this.loadClientes();
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Erro ao salvar cliente:', error);
            this.showAlert('Erro ao salvar cliente: ' + error.message, 'error');
        }
    }

    closeClienteModal() {
        document.getElementById('modalCliente').classList.remove('active');
        this.state.clienteEditando = null;
    }

    editCliente(clienteId) {
        this.openClienteModal(clienteId);
    }

    async deleteCliente(clienteId) {
        if (!confirm('Tem certeza que deseja excluir este cliente?')) {
            return;
        }
        
        try {
            // Verificar se o cliente tem vendas
            const vendasSnapshot = await firebaseServices.db.collection('vendas')
                .where('clienteId', '==', clienteId)
                .limit(1)
                .get();
            
            if (!vendasSnapshot.empty) {
                this.showAlert('Este cliente não pode ser excluído porque tem vendas registradas', 'warning');
                return;
            }
            
            // Excluir cliente
            await firebaseServices.db.collection('clientes')
                .doc(clienteId)
                .delete();
                
            this.showAlert('Cliente excluído com sucesso!', 'success');
            
            // Atualizar dados
            await this.loadClientes();
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Erro ao excluir cliente:', error);
            this.showAlert('Erro ao excluir cliente: ' + error.message, 'error');
        }
    }

    filtrarClientes() {
        const busca = document.getElementById('buscaCliente').value.toLowerCase();
        
        const clientesFiltrados = this.state.clientes.filter(cliente => {
            return !busca || 
                cliente.nome.toLowerCase().includes(busca) ||
                (cliente.cpfCnpj && cliente.cpfCnpj.includes(busca)) ||
                cliente.telefone.includes(busca) ||
                (cliente.email && cliente.email.toLowerCase().includes(busca));
        });
        
        const tbody = document.querySelector('#tabelaClientes tbody');
        tbody.innerHTML = '';
        
        if (clientesFiltrados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-search"></i>
                        <p>Nenhum cliente encontrado</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        clientesFiltrados.forEach(cliente => {
            this.renderClienteRow(cliente, tbody);
        });
    }

    async exportarClientes() {
        try {
            const clientes = await firebaseServices.exportData('clientes');
            
            const dados = JSON.stringify(clientes, null, 2);
            const blob = new Blob([dados], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `clientes_sisloja_${dayjs().format('YYYY-MM-DD')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            this.showAlert('Clientes exportados com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao exportar clientes:', error);
            this.showAlert('Erro ao exportar clientes: ' + error.message, 'error');
        }
    }

    // Módulo de Relatórios
    setupRelatoriosModule() {
        document.getElementById('btnGerarRelatorio').addEventListener('click', () => {
            this.gerarRelatorio();
        });
        
        document.getElementById('btnImprimirRelatorio').addEventListener('click', () => {
            this.imprimirRelatorio();
        });
        
        // Configurar datas padrão
        const hoje = dayjs().format('YYYY-MM-DD');
        const primeiroDiaMes = dayjs().startOf('month').format('YYYY-MM-DD');
        
        document.getElementById('relatorioDataInicio').value = primeiroDiaMes;
        document.getElementById('relatorioDataFim').value = hoje;
    }

    setupRelatorios() {
        // Gerar relatório inicial
        this.gerarRelatorio();
    }

    async gerarRelatorio() {
        const tipo = document.getElementById('tipoRelatorio').value;
        const dataInicio = document.getElementById('relatorioDataInicio').value;
        const dataFim = document.getElementById('relatorioDataFim').value;
        
        const container = document.getElementById('relatorioContainer');
        container.innerHTML = '<div class="loader"></div>';
        
        try {
            let html = '';
            
            switch (tipo) {
                case 'vendas':
                    html = await this.gerarRelatorioVendas(dataInicio, dataFim);
                    break;
                case 'produtos':
                    html = await this.gerarRelatorioProdutosMaisVendidos(dataInicio, dataFim);
                    break;
                case 'estoque':
                    html = await this.gerarRelatorioEstoqueBaixo();
                    break;
                case 'faturamento':
                    html = await this.gerarRelatorioFaturamentoMensal();
                    break;
                case 'clientes':
                    html = await this.gerarRelatorioClientesAtivos(dataInicio, dataFim);
                    break;
            }
            
            container.innerHTML = html;
            
        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            container.innerHTML = `
                <div class="alert alert-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    Erro ao gerar relatório: ${error.message}
                </div>
            `;
        }
    }

    async gerarRelatorioVendas(dataInicio, dataFim) {
        // Implementar relatório de vendas
        return '<div class="empty-state">Relatório de vendas em desenvolvimento</div>';
    }

    async gerarRelatorioProdutosMaisVendidos(dataInicio, dataFim) {
        // Implementar relatório de produtos mais vendidos
        return '<div class="empty-state">Relatório de produtos mais vendidos em desenvolvimento</div>';
    }

    async gerarRelatorioEstoqueBaixo() {
        try {
            const produtos = await firebaseServices.db.collection('produtos')
                .where('estoque', '<=', firebase.firestore.FieldValue.increment(this.state.config.estoqueMinimo))
                .get();
            
            if (produtos.empty) {
                return '<div class="empty-state">Nenhum produto com estoque baixo</div>';
            }
            
            let html = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Produto</th>
                                <th>Categoria</th>
                                <th>Estoque</th>
                                <th>Mínimo</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            produtos.forEach(doc => {
                const produto = doc.data();
                const status = produto.estoque === 0 ? 
                    '<span class="status-badge status-danger">ESGOTADO</span>' :
                    '<span class="status-badge status-warning">BAIXO</span>';
                
                html += `
                    <tr>
                        <td>${produto.codigo}</td>
                        <td>${produto.nome}</td>
                        <td>${produto.categoria}</td>
                        <td>${produto.estoque}</td>
                        <td>${produto.estoqueMinimo || this.state.config.estoqueMinimo}</td>
                        <td>${status}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            return html;
            
        } catch (error) {
            console.error('Erro ao gerar relatório de estoque:', error);
            return `<div class="alert alert-error">Erro ao gerar relatório: ${error.message}</div>`;
        }
    }

    async gerarRelatorioFaturamentoMensal() {
        // Implementar relatório de faturamento mensal
        return '<div class="empty-state">Relatório de faturamento mensal em desenvolvimento</div>';
    }

    async gerarRelatorioClientesAtivos(dataInicio, dataFim) {
        // Implementar relatório de clientes ativos
        return '<div class="empty-state">Relatório de clientes ativos em desenvolvimento</div>';
    }

    imprimirRelatorio() {
        const conteudo = document.getElementById('relatorioContainer').innerHTML;
        const titulo = document.getElementById('tipoRelatorio').options[document.getElementById('tipoRelatorio').selectedIndex].text;
        
        const janela = window.open('', '_blank');
        janela.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório SisLoja - ${titulo}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #e63946; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
                    .status-danger { background: #ffeaea; color: #e63946; }
                    .status-warning { background: #fff3e0; color: #f4a261; }
                </style>
            </head>
            <body>
                <h1>Relatório: ${titulo}</h1>
                <p>Data: ${dayjs().format('DD/MM/YYYY HH:mm')}</p>
                ${conteudo}
            </body>
            </html>
        `);
        janela.document.close();
        janela.print();
    }

    // Módulo de Códigos de Barras
    setupCodigosModule() {
        document.getElementById('btnGerarCodigo').addEventListener('click', () => {
            this.gerarCodigoBarras();
        });
        
        document.getElementById('btnImprimirCodigo').addEventListener('click', () => {
            this.imprimirCodigoBarras();
        });
        
        document.getElementById('btnSalvarCodigo').addEventListener('click', () => {
            this.salvarCodigoBarras();
        });
        
        document.getElementById('btnValidarCodigo').addEventListener('click', () => {
            this.validarCodigoBarras();
        });
        
        document.getElementById('btnGerarLote').addEventListener('click', () => {
            this.gerarLoteCodigos();
        });
        
        // Configurar controles de range
        document.getElementById('larguraCodigo').addEventListener('input', (e) => {
            document.getElementById('larguraValor').textContent = e.target.value;
        });
        
        document.getElementById('alturaCodigo').addEventListener('input', (e) => {
            document.getElementById('alturaValor').textContent = e.target.value;
        });
    }

    setupBarcodeGenerator() {
        // Gerar código inicial
        this.gerarCodigoBarras();
    }

    gerarCodigoBarras() {
        const tipo = document.getElementById('tipoCodigo').value;
        const valor = document.getElementById('valorCodigo').value.trim();
        const texto = document.getElementById('textoCodigo').value;
        const largura = parseFloat(document.getElementById('larguraCodigo').value);
        const altura = parseInt(document.getElementById('alturaCodigo').value);
        
        if (!valor) {
            this.showAlert('Digite um valor para gerar o código', 'warning');
            return;
        }
        
        try {
            const svg = document.getElementById('barcodeDisplay');
            svg.innerHTML = '';
            
            const options = {
                width: largura,
                height: altura,
                displayValue: true,
                fontSize: 16,
                background: 'white',
                lineColor: '#000000',
                margin: 10
            };
            
            // Configurar opções específicas por tipo
            switch (tipo) {
                case 'EAN13':
                    if (valor.length === 12) {
                        const digito = this.calcularDigitoVerificadorEAN(valor);
                        options.value = valor + digito;
                    } else if (valor.length === 13) {
                        options.value = valor;
                    } else {
                        throw new Error('EAN-13 requer 12 ou 13 dígitos');
                    }
                    options.format = 'EAN13';
                    break;
                    
                case 'CODE128':
                    options.format = 'CODE128';
                    options.value = valor;
                    break;
                    
                case 'CODE39':
                    options.format = 'CODE39';
                    options.value = valor.toUpperCase();
                    break;
                    
                case 'UPC':
                    options.format = 'UPC';
                    options.value = valor;
                    break;
                    
                case 'ITF14':
                    options.format = 'ITF14';
                    options.value = valor;
                    break;
            }
            
            JsBarcode(svg, options.value, options);
            
            // Exibir texto
            const textoDisplay = document.getElementById('textoDisplay');
            if (texto) {
                textoDisplay.textContent = texto;
                textoDisplay.style.display = 'block';
            } else {
                textoDisplay.style.display = 'none';
            }
            
            this.showAlert('Código de barras gerado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao gerar código:', error);
            this.showAlert('Erro ao gerar código: ' + error.message, 'error');
        }
    }

    validarCodigoBarras() {
        const codigo = document.getElementById('validarCodigo').value.trim();
        const resultado = document.getElementById('validacaoResultado');
        
        if (!codigo) {
            resultado.innerHTML = '<div class="alert alert-warning">Digite um código para validar</div>';
            return;
        }
        
        try {
            // Verificar EAN-13
            if (codigo.length === 13) {
                const baseCodigo = codigo.substring(0, 12);
                const digitoVerificador = parseInt(codigo[12]);
                const digitoCalculado = this.calcularDigitoVerificadorEAN(baseCodigo);
                
                if (digitoVerificador === digitoCalculado) {
                    resultado.innerHTML = `
                        <div class="alert alert-success">
                            <i class="fas fa-check-circle"></i>
                            <strong>Código EAN-13 válido!</strong><br>
                            Dígito verificador correto: ${digitoVerificador}
                        </div>
                    `;
                } else {
                    resultado.innerHTML = `
                        <div class="alert alert-error">
                            <i class="fas fa-times-circle"></i>
                            <strong>Código EAN-13 inválido!</strong><br>
                            Dígito verificador esperado: ${digitoCalculado}<br>
                            Dígito verificador informado: ${digitoVerificador}
                        </div>
                    `;
                }
            } else {
                resultado.innerHTML = `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        Código com ${codigo.length} dígitos<br>
                        Não é um EAN-13 (13 dígitos)
                    </div>
                `;
            }
            
        } catch (error) {
            resultado.innerHTML = `
                <div class="alert alert-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    Erro ao validar código: ${error.message}
                </div>
            `;
        }
    }

    gerarLoteCodigos() {
        const quantidade = parseInt(document.getElementById('quantidadeCodigos').value);
        const prefixo = document.getElementById('prefixoCodigos').value;
        const inicio = parseInt(document.getElementById('inicioCodigos').value);
        
        if (quantidade < 1 || quantidade > 100) {
            this.showAlert('Quantidade deve ser entre 1 e 100', 'warning');
            return;
        }
        
        const container = document.getElementById('loteResultado');
        container.innerHTML = '';
        
        for (let i = 0; i < quantidade; i++) {
            const numero = inicio + i;
            const codigo = prefixo + numero.toString().padStart(6, '0');
            
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div style="font-weight: 600;">${codigo}</div>
                <button onclick="sisloja.usarCodigo('${codigo}')" class="btn btn-primary btn-sm">
                    Usar
                </button>
            `;
            container.appendChild(div);
        }
        
        this.showAlert(`${quantidade} códigos gerados com sucesso!`, 'success');
    }

    usarCodigo(codigo) {
        document.getElementById('valorCodigo').value = codigo;
        this.gerarCodigoBarras();
    }

    imprimirCodigoBarras() {
        const svg = document.getElementById('barcodeDisplay').innerHTML;
        const texto = document.getElementById('textoDisplay').textContent;
        
        if (!svg || svg.trim() === '') {
            this.showAlert('Gere um código primeiro', 'warning');
            return;
        }
        
        const janela = window.open('', '_blank');
        janela.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Etiqueta de Código de Barras</title>
                <style>
                    body { 
                        margin: 0; 
                        padding: 20px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                    }
                    .barcode-container {
                        text-align: center;
                        padding: 20px;
                    }
                    .texto {
                        margin-top: 10px;
                        font-size: 16px;
                        font-weight: bold;
                    }
                    @media print {
                        body { margin: 0; padding: 10px; }
                    }
                </style>
            </head>
            <body>
                <div class="barcode-container">
                    ${svg}
                    ${texto ? `<div class="texto">${texto}</div>` : ''}
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 1000);
                    };
                <\/script>
            </body>
            </html>
        `);
        janela.document.close();
    }

    salvarCodigoBarras() {
        const svg = document.getElementById('barcodeDisplay');
        
        if (!svg || svg.innerHTML === '') {
            this.showAlert('Gere um código primeiro', 'warning');
            return;
        }
        
        try {
            // Converter SVG para imagem
            const serializer = new XMLSerializer();
            const source = serializer.serializeToString(svg);
            const blob = new Blob([source], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = svg.clientWidth || 300;
                canvas.height = svg.clientHeight || 150;
                
                const ctx = canvas.getContext('2d');
                
                // Fundo branco
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Desenhar código
                ctx.drawImage(img, 0, 0);
                
                // Adicionar texto
                const texto = document.getElementById('textoDisplay').textContent;
                if (texto) {
                    ctx.fillStyle = 'black';
                    ctx.font = '14px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(texto, canvas.width / 2, canvas.height - 10);
                }
                
                // Converter para PNG
                const dataURL = canvas.toDataURL('image/png');
                
                // Criar link de download
                const a = document.createElement('a');
                a.href = dataURL;
                a.download = `codigo_barras_${dayjs().format('YYYYMMDD_HHmmss')}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                URL.revokeObjectURL(url);
                
                this.showAlert('Código salvo como imagem!', 'success');
            };
            
            img.src = url;
            
        } catch (error) {
            console.error('Erro ao salvar código:', error);
            this.showAlert('Erro ao salvar código: ' + error.message, 'error');
        }
    }

    // Módulo de Configurações
    setupConfiguracoesModule() {
        document.getElementById('btnExportarDados').addEventListener('click', () => {
            this.exportarTodosDados();
        });
        
        document.getElementById('btnImportarDados').addEventListener('click', () => {
            document.getElementById('importarArquivo').click();
        });
        
        document.getElementById('importarArquivo').addEventListener('change', (e) => {
            this.importarDados(e);
        });
        
        document.getElementById('btnLimparDados').addEventListener('click', () => {
            this.limparTodosDados();
        });
        
        // Configurar salvamento automático das configurações
        ['nomeLoja', 'cnpjLoja', 'telefoneLoja', 'enderecoLoja', 'estoqueMinimoAlerta', 'impostoPadrao', 'emailNotificacoes'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                this.salvarConfiguracoes();
            });
        });
        
        ['notificacoesAtivas', 'backupAutomatico', 'imprimirRecibo'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                this.salvarConfiguracoes();
            });
        });
    }

    async loadConfiguracoes() {
        try {
            // Buscar configurações do Firestore
            const configDoc = await firebaseServices.db.collection('config')
                .doc('sistema')
                .get();
            
            if (configDoc.exists) {
                const config = configDoc.data();
                this.state.config = { ...this.state.config, ...config };
                this.aplicarConfiguracoes();
            }
            
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    }

    aplicarConfiguracoes() {
        const config = this.state.config;
        
        // Aplicar configurações nos campos
        document.getElementById('nomeLoja').value = config.nomeLoja || '';
        document.getElementById('cnpjLoja').value = config.cnpjLoja || '';
        document.getElementById('telefoneLoja').value = config.telefoneLoja || '';
        document.getElementById('enderecoLoja').value = config.enderecoLoja || '';
        document.getElementById('estoqueMinimoAlerta').value = config.estoqueMinimo || 5;
        document.getElementById('impostoPadrao').value = config.impostoPadrao || 0;
        document.getElementById('emailNotificacoes').value = config.emailNotificacoes || '';
        
        // Aplicar checkboxes
        document.getElementById('notificacoesAtivas').checked = config.notificacoesAtivas !== false;
        document.getElementById('backupAutomatico').checked = config.backupAutomatico !== false;
        document.getElementById('imprimirRecibo').checked = config.imprimirRecibo !== false;
    }

    async salvarConfiguracoes() {
        try {
            const config = {
                nomeLoja: document.getElementById('nomeLoja').value,
                cnpjLoja: document.getElementById('cnpjLoja').value || null,
                telefoneLoja: document.getElementById('telefoneLoja').value || null,
                enderecoLoja: document.getElementById('enderecoLoja').value || null,
                estoqueMinimo: parseInt(document.getElementById('estoqueMinimoAlerta').value) || 5,
                impostoPadrao: parseFloat(document.getElementById('impostoPadrao').value) || 0,
                emailNotificacoes: document.getElementById('emailNotificacoes').value || null,
                notificacoesAtivas: document.getElementById('notificacoesAtivas').checked,
                backupAutomatico: document.getElementById('backupAutomatico').checked,
                imprimirRecibo: document.getElementById('imprimirRecibo').checked,
                atualizadoEm: new Date()
            };
            
            // Validar campos obrigatórios
            if (!config.nomeLoja) {
                this.showAlert('Nome da loja é obrigatório', 'error');
                return;
            }
            
            // Salvar no Firestore
            await firebaseServices.db.collection('config')
                .doc('sistema')
                .set(config, { merge: true });
            
            // Atualizar estado local
            this.state.config = { ...this.state.config, ...config };
            
            this.showAlert('Configurações salvas com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            this.showAlert('Erro ao salvar configurações: ' + error.message, 'error');
        }
    }

    async exportarTodosDados() {
        if (!confirm('Exportar todos os dados do sistema?')) {
            return;
        }
        
        try {
            // Coletar todos os dados
            const dados = {
                produtos: await firebaseServices.exportData('produtos'),
                clientes: await firebaseServices.exportData('clientes'),
                vendas: await firebaseServices.exportData('vendas'),
                config: this.state.config,
                exportadoEm: new Date().toISOString(),
                versao: '1.0.0'
            };
            
            const dadosJSON = JSON.stringify(dados, null, 2);
            const blob = new Blob([dadosJSON], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_sisloja_${dayjs().format('YYYY-MM-DD_HH-mm')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            this.showAlert('Backup criado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao exportar dados:', error);
            this.showAlert('Erro ao exportar dados: ' + error.message, 'error');
        }
    }

    async importarDados(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!confirm('Importar dados substituirá todos os dados atuais. Tem certeza?')) {
            document.getElementById('importarArquivo').value = '';
            return;
        }
        
        try {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const dados = JSON.parse(e.target.result);
                    
                    // Importar produtos
                    if (dados.produtos && Array.isArray(dados.produtos)) {
                        await firebaseServices.importData('produtos', dados.produtos);
                    }
                    
                    // Importar clientes
                    if (dados.clientes && Array.isArray(dados.clientes)) {
                        await firebaseServices.importData('clientes', dados.clientes);
                    }
                    
                    // Importar vendas
                    if (dados.vendas && Array.isArray(dados.vendas)) {
                        await firebaseServices.importData('vendas', dados.vendas);
                    }
                    
                    // Importar configurações
                    if (dados.config) {
                        this.state.config = { ...this.state.config, ...dados.config };
                        await this.salvarConfiguracoes();
                    }
                    
                    document.getElementById('importarArquivo').value = '';
                    
                    // Atualizar interface
                    await this.loadDashboardData();
                    
                    this.showAlert('Dados importados com sucesso!', 'success');
                    
                } catch (parseError) {
                    console.error('Erro ao analisar arquivo:', parseError);
                    this.showAlert('Arquivo inválido. Certifique-se de que é um backup válido do SisLoja.', 'error');
                }
            };
            
            reader.onerror = () => {
                this.showAlert('Erro ao ler arquivo', 'error');
            };
            
            reader.readAsText(file);
            
        } catch (error) {
            console.error('Erro ao importar dados:', error);
            this.showAlert('Erro ao importar dados: ' + error.message, 'error');
        }
    }

    async limparTodosDados() {
        if (!confirm('ATENÇÃO: Esta ação apagará TODOS os dados do sistema. É irreversível. Tem certeza?')) {
            return;
        }
        
        if (!confirm('CONFIRMAÇÃO FINAL: Você realmente deseja apagar TODOS os dados?')) {
            return;
        }
        
        try {
            // Limpar todos os dados
            await firebaseServices.clearData('produtos');
            await firebaseServices.clearData('clientes');
            await firebaseServices.clearData('vendas');
            
            this.showAlert('Todos os dados foram limpos', 'success');
            
            // Atualizar interface
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Erro ao limpar dados:', error);
            this.showAlert('Erro ao limpar dados: ' + error.message, 'error');
        }
    }

    // Métodos públicos para acesso via HTML
    imprimirRecibo(vendaId) {
        this.gerarRecibo(vendaId);
    }
}

// Inicializar aplicação
let sisloja;
document.addEventListener('DOMContentLoaded', () => {
    sisloja = new SisLoja();
    window.sisloja = sisloja; // Expor para acesso global
});

import {
	Connection,
	Transaction,
	TransactionInstruction,
	PublicKey,
	VersionedTransaction,
	TransactionMessage,
} from '@solana/web3.js';
import {
	RetryTxSender,
	WhileValidTxSender,
	Wallet,
	loadKeypair,
} from '../src';

// ============================================================================
// Configuration
// ============================================================================

const RPC_ENDPOINT = 'https://api.devnet.solana.com';
const MEMO_PROGRAM_ID = new PublicKey(
	'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
);

// ============================================================================
// Helper Functions
// ============================================================================

function initializeWallet() {
	const privateKey = process.env.PRIVATE_KEY!;
	const feePayerPrivateKey = process.env.FEE_PAYER_PRIVATE_KEY!;

	const keypair = loadKeypair(privateKey);
	const feePayerKeypair = loadKeypair(feePayerPrivateKey);

	return new Wallet(keypair, feePayerKeypair);
}

function logWalletInfo(wallet: Wallet) {
	console.log('\n========================================');
	console.log('Wallet Information');
	console.log('========================================');
	console.log('Authority Public Key:', wallet.publicKey.toBase58());
	console.log('Fee Payer Public Key:', wallet.payer?.publicKey?.toBase58());
	console.log('========================================\n');
}

function createMemoInstruction(
	wallet: Wallet,
	memoText: string
): TransactionInstruction {
	return new TransactionInstruction({
		keys: [
			{ pubkey: wallet.authority.publicKey, isSigner: true, isWritable: true },
			{
				pubkey: wallet.payer?.publicKey ?? wallet.publicKey,
				isSigner: false,
				isWritable: true,
			},
		],
		data: Buffer.from(memoText, 'utf-8'),
		programId: MEMO_PROGRAM_ID,
	});
}

function createLegacyTransaction(
	wallet: Wallet,
	memoText: string
): Transaction {
	return new Transaction({
		feePayer: wallet.payer?.publicKey ?? wallet.publicKey,
	}).add(createMemoInstruction(wallet, memoText));
}

async function createVersionedTransactionMessage(
	wallet: Wallet,
	connection: Connection,
	memoText: string
): Promise<TransactionMessage> {
	const { blockhash } = await connection.getLatestBlockhash();

	return new TransactionMessage({
		payerKey: wallet.payer?.publicKey ?? wallet.publicKey,
		instructions: [createMemoInstruction(wallet, memoText)],
		recentBlockhash: blockhash,
	});
}

function logTransactionResult(
	senderType: string,
	txType: string,
	txSig: string
) {
	console.log(`\n✅ ${senderType} - ${txType} sent successfully`);
	console.log(`   Signature: ${txSig}`);
	console.log(`   Explorer: https://solscan.io/tx/${txSig}?cluster=devnet\n`);
}

async function verifyTransactionFeePayer(
	connection: Connection,
	txSig: string,
	expectedFeePayer: PublicKey
): Promise<void> {
	console.log('🔍 Verifying transaction details...');

	// Wait a bit to ensure transaction is confirmed
	await new Promise((resolve) => setTimeout(resolve, 2000));

	const tx = await connection.getParsedTransaction(txSig, {
		commitment: 'confirmed',
		maxSupportedTransactionVersion: 0,
	});

	if (!tx) {
		throw new Error(`Transaction ${txSig} not found`);
	}

	// Get fee payer from transaction
	const actualFeePayer = tx.transaction.message.accountKeys[0].pubkey;

	console.log('   Expected Fee Payer:', expectedFeePayer.toBase58());
	console.log('   Actual Fee Payer:  ', actualFeePayer.toBase58());
	console.log('   Transaction Fee:   ', tx.meta?.fee || 0, 'lamports');

	// Log all signers
	const signers = tx.transaction.message.accountKeys
		.filter((key) => key.signer)
		.map((key) => key.pubkey.toBase58());
	console.log('   Signers:');
	signers.forEach((signer, idx) => {
		console.log(`     ${idx + 1}. ${signer}`);
	});

	// Verify fee payer matches expected
	if (!actualFeePayer.equals(expectedFeePayer)) {
		throw new Error(
			`Fee payer mismatch! Expected: ${expectedFeePayer.toBase58()}, Got: ${actualFeePayer.toBase58()}`
		);
	}

	console.log('   ✅ Fee payer verification passed!\n');
}

function logSectionHeader(title: string) {
	console.log('\n========================================');
	console.log(title);
	console.log('========================================\n');
}

// ============================================================================
// Test Functions
// ============================================================================

async function testRetryTxSender(wallet: Wallet, connection: Connection) {
	logSectionHeader('Testing RetryTxSender');

	const retryTxSender = new RetryTxSender({
		connection,
		wallet,
	});

	const expectedFeePayer = wallet.payer?.publicKey ?? wallet.publicKey;

	// Test Legacy Transaction
	console.log('📤 Sending legacy transaction...');
	const legacyTx = createLegacyTransaction(
		wallet,
		'RetryTxSender - Legacy Transaction Test'
	);
	const { txSig: legacyTxSig } = await retryTxSender.send(legacyTx);
	logTransactionResult('RetryTxSender', 'Legacy Transaction', legacyTxSig);
	await verifyTransactionFeePayer(connection, legacyTxSig, expectedFeePayer);

	// Test Versioned Transaction
	console.log('📤 Sending versioned transaction...');
	const versionedTxMessage = await createVersionedTransactionMessage(
		wallet,
		connection,
		'RetryTxSender - Versioned Transaction Test'
	);
	const versionedTx = new VersionedTransaction(
		versionedTxMessage.compileToV0Message([])
	);
	const { txSig: versionedTxSig } =
		await retryTxSender.sendVersionedTransaction(versionedTx);
	logTransactionResult(
		'RetryTxSender',
		'Versioned Transaction',
		versionedTxSig
	);
	await verifyTransactionFeePayer(connection, versionedTxSig, expectedFeePayer);
}

async function testWhileValidTxSender(wallet: Wallet, connection: Connection) {
	logSectionHeader('Testing WhileValidTxSender');

	const whileValidTxSender = new WhileValidTxSender({
		connection,
		wallet,
		retrySleep: 1000, // Retry every 1 second
	});

	const expectedFeePayer = wallet.payer?.publicKey ?? wallet.publicKey;

	// Test Legacy Transaction
	console.log('📤 Sending legacy transaction...');
	const legacyTx = createLegacyTransaction(
		wallet,
		'WhileValidTxSender - Legacy Transaction Test'
	);
	const { txSig: legacyTxSig } = await whileValidTxSender.send(legacyTx);
	logTransactionResult('WhileValidTxSender', 'Legacy Transaction', legacyTxSig);
	await verifyTransactionFeePayer(connection, legacyTxSig, expectedFeePayer);

	// Test Versioned Transaction
	console.log('📤 Sending versioned transaction...');
	const versionedTxMessage = await createVersionedTransactionMessage(
		wallet,
		connection,
		'WhileValidTxSender - Versioned Transaction Test'
	);
	const versionedTx = new VersionedTransaction(
		versionedTxMessage.compileToV0Message([])
	);
	const { txSig: versionedTxSig } =
		await whileValidTxSender.sendVersionedTransaction(versionedTx);
	logTransactionResult(
		'WhileValidTxSender',
		'Versioned Transaction',
		versionedTxSig
	);
	await verifyTransactionFeePayer(connection, versionedTxSig, expectedFeePayer);
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
	try {
		const connection = new Connection(RPC_ENDPOINT);

		// Case 1: Wallet with separate fee payer
		logSectionHeader('Case 1: Testing with SEPARATE Fee Payer');
		const walletWithFeePayer = initializeWallet();
		logWalletInfo(walletWithFeePayer);

		if (!walletWithFeePayer.payer) {
			console.warn(
				'⚠️  Warning: FEE_PAYER_PRIVATE_KEY not set. Skipping separate fee payer tests.'
			);
		} else {
			console.log(
				'✅ Fee payer is DIFFERENT from authority - this should be reflected in transaction logs\n'
			);

			// Test RetryTxSender with separate fee payer
			await testRetryTxSender(walletWithFeePayer, connection);

			// Test WhileValidTxSender with separate fee payer
			await testWhileValidTxSender(walletWithFeePayer, connection);
		}

		// Case 2: Wallet without separate fee payer (authority pays fees)
		logSectionHeader('Case 2: Testing with SAME Authority and Fee Payer');
		const privateKey = process.env.PRIVATE_KEY!;
		const keypair = loadKeypair(privateKey);
		const walletWithoutFeePayer = new Wallet(keypair); // No separate fee payer
		logWalletInfo(walletWithoutFeePayer);

		console.log(
			'✅ Fee payer is SAME as authority - this should be reflected in transaction logs\n'
		);

		// Test RetryTxSender without separate fee payer
		await testRetryTxSender(walletWithoutFeePayer, connection);

		// Test WhileValidTxSender without separate fee payer
		await testWhileValidTxSender(walletWithoutFeePayer, connection);

		logSectionHeader('All Tests Completed Successfully! 🎉');
		console.log('Summary:');
		console.log('✅ Verified fee payer is correctly set when using separate fee payer');
		console.log(
			'✅ Verified fee payer is correctly set when authority pays fees'
		);
		console.log('✅ All transaction logs confirmed correct fee payer assignment\n');
	} catch (error) {
		console.error('\n❌ Error occurred:', error);
		process.exit(1);
	}
}

main();

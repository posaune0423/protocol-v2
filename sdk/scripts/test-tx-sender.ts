import {
	Connection,
	Transaction,
	TransactionInstruction,
	PublicKey,
	VersionedTransaction,
	TransactionMessage,
} from '@solana/web3.js';
import { RetryTxSender, Wallet, loadKeypair } from '../src';

const rpcEndpoint = 'https://api.devnet.solana.com';
const privateKey = process.env.PRIVATE_KEY!;
const feePayerPrivateKey = process.env.FEE_PAYER_PRIVATE_KEY!;

const keypair = loadKeypair(privateKey);
const feePayerKeypair = loadKeypair(feePayerPrivateKey);

const wallet = new Wallet(keypair, feePayerKeypair);
console.log('wallet public key', wallet.publicKey.toBase58());
console.log('wallet payer public key', wallet.payer?.publicKey?.toBase58());

const retryTxSender = new RetryTxSender({
	connection: new Connection(rpcEndpoint),
	wallet,
});

const tx = new Transaction({
	feePayer: wallet.payer?.publicKey ?? wallet.publicKey,
}).add(
	new TransactionInstruction({
		keys: [
			{ pubkey: wallet.signer.publicKey, isSigner: true, isWritable: true },
			{
				pubkey: wallet.payer?.publicKey ?? wallet.publicKey,
				isSigner: false,
				isWritable: true,
			},
		],
		data: Buffer.from('test test legacy tx', 'utf-8'),
		programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
	})
);

console.log('starting legacy tx');

const { txSig } = await retryTxSender.send(tx);
console.log('legacy tx sent', txSig);
console.log(`Legacy tx: https://solscan.io/tx/${txSig}?cluster=devnet`);

const versionedTx = new TransactionMessage({
	payerKey: wallet.payer?.publicKey ?? wallet.publicKey,
	instructions: [
		new TransactionInstruction({
			keys: [
				{ pubkey: wallet.signer.publicKey, isSigner: true, isWritable: true },
				{
					pubkey: wallet.payer?.publicKey ?? wallet.publicKey,
					isSigner: false,
					isWritable: true,
				},
			],
			data: Buffer.from('test test versioned tx', 'utf-8'),
			programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
		}),
	],
	recentBlockhash: (await retryTxSender.connection.getLatestBlockhash())
		.blockhash,
}).compileToV0Message([]);

console.log('starting versioned tx');
const { txSig: versionedTxSig } = await retryTxSender.sendVersionedTransaction(
	new VersionedTransaction(versionedTx)
);
console.log('versioned tx sent', versionedTxSig);
console.log(
	`Versioned tx: https://solscan.io/tx/${versionedTxSig}?cluster=devnet`
);

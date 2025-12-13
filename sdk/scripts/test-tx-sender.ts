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
const privateKey = 'put your private key here'; // fill this in with a devnet key

const keypair = loadKeypair(privateKey);

const retryTxSender = new RetryTxSender({
	connection: new Connection(rpcEndpoint),
	wallet: new Wallet(keypair),
});

const tx = new Transaction().add(
	new TransactionInstruction({
		keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: true }],
		data: Buffer.from('test test legacy tx', 'utf-8'),
		programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
	})
);
console.log(
	`Legacy tx: https://explorer.solana.com/tx/${
		(await retryTxSender.send(tx)).txSig
	}?cluster=devnet`
);

const versionedTx = new TransactionMessage({
	payerKey: keypair.publicKey,
	instructions: [
		new TransactionInstruction({
			keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: true }],
			data: Buffer.from('test test versioned tx', 'utf-8'),
			programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
		}),
	],
	recentBlockhash: (await retryTxSender.connection.getLatestBlockhash())
		.blockhash,
}).compileToV0Message([]);
console.log(
	`Versioned tx: https://explorer.solana.com/tx/${
		(
			await retryTxSender.sendVersionedTransaction(
				new VersionedTransaction(versionedTx)
			)
		).txSig
	}?cluster=devnet`
);

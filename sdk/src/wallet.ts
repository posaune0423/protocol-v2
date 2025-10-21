import {
	Keypair,
	PublicKey,
	Transaction,
	VersionedTransaction,
} from '@solana/web3.js';
import { IWallet, IVersionedWallet } from './types';
import nacl from 'tweetnacl';

export class Wallet implements IWallet, IVersionedWallet {
	constructor(
		readonly signer: Keypair,
		readonly payer?: Keypair
	) {
		this.payer = payer ?? signer;
	}

	async signTransaction(tx: Transaction): Promise<Transaction> {
		if (this.payer && this.payer.publicKey.toBase58() !== this.signer.publicKey.toBase58()) {
			tx.partialSign(this.payer, this.signer);
		} else {
			tx.partialSign(this.signer);
		}
		return tx;
	}

	async signVersionedTransaction(
		tx: VersionedTransaction
	): Promise<VersionedTransaction> {
		if (this.payer && this.payer.publicKey.toBase58() !== this.signer.publicKey.toBase58()) {
			tx.sign([this.payer, this.signer]);
		} else {
			tx.sign([this.signer]);
		}
		return tx;
	}

	async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
		return txs.map((t) => {
			if (this.payer && this.payer.publicKey.toBase58() !== this.signer.publicKey.toBase58()) {
				t.partialSign(this.payer, this.signer);
			} else {
				t.partialSign(this.signer);
			}
			return t;
		});
	}

	async signAllVersionedTransactions(
		txs: VersionedTransaction[]
	): Promise<VersionedTransaction[]> {
		return txs.map((t) => {
			if (this.payer && this.payer.publicKey.toBase58() !== this.signer.publicKey.toBase58()) {
				t.sign([this.payer, this.signer]);
			} else {
				t.sign([this.signer]);
			}
			return t;
		});
	}

	get publicKey(): PublicKey {
		return this.signer.publicKey;
	}
}

export class WalletV2 extends Wallet {
	constructor(readonly signer: Keypair) {
		super(signer);
	}

	async signMessage(message: Uint8Array): Promise<Uint8Array> {
		return Buffer.from(nacl.sign.detached(message, this.signer.secretKey));
	}
}

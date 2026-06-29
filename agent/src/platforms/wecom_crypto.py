import base64
import hashlib
import socket
import struct
import xml.etree.ElementTree as ET
from typing import Tuple, Union
from Crypto.Cipher import AES

class PKCS7Encoder:
    """PKCS7 padding encoder and decoder for block size 32."""
    @staticmethod
    def encode(text_bytes: bytes) -> bytes:
        block_size = 32
        text_length = len(text_bytes)
        amount_to_pad = block_size - (text_length % block_size)
        pad = bytes([amount_to_pad] * amount_to_pad)
        return text_bytes + pad

    @staticmethod
    def decode(decrypted_bytes: bytes) -> bytes:
        pad = decrypted_bytes[-1]
        if pad < 1 or pad > 32:
            pad = 0
        return decrypted_bytes[:-pad] if pad else decrypted_bytes


class WecomCryptor:
    """Handles signature verification, decryption and encryption of Enterprise WeChat messages."""

    def __init__(self, token: str, aes_key: str, receive_id: str):
        self.token = token.strip()
        # AES key in WeCom is Base64 encoded and 43 chars long.
        # Decoded it yields a 32-byte key.
        self.key = base64.b64decode(aes_key.strip() + "=")
        assert len(self.key) == 32
        self.receive_id = receive_id.strip()

    def verify_signature(self, signature: str, timestamp: str, nonce: str, encrypt_msg: str) -> bool:
        """Verify message signature sent from WeCom."""
        sort_list = sorted([self.token, timestamp, nonce, encrypt_msg])
        sha1 = hashlib.sha1()
        sha1.update("".join(sort_list).encode("utf-8"))
        return sha1.hexdigest() == signature

    def decrypt(self, encrypt_msg: str) -> str:
        """Decrypt WeCom message.
        
        Returns the raw XML content string.
        """
        try:
            aes_msg = base64.b64decode(encrypt_msg)
            iv = self.key[:16]
            cipher = AES.new(self.key, AES.MODE_CBC, iv)
            decrypted = cipher.decrypt(aes_msg)
            
            # Remove PKCS7 padding
            plain_text = PKCS7Encoder.decode(decrypted)
            
            # Extract random prefix (16 bytes) and content length (4 bytes)
            xml_len = struct.unpack("!I", plain_text[16:20])[0]
            xml_content = plain_text[20 : 20 + xml_len].decode("utf-8")
            from_receive_id = plain_text[20 + xml_len :].decode("utf-8").strip()
            
            # Verify that the message CorpID matches our CorpID (receive_id)
            if from_receive_id != self.receive_id:
                raise ValueError(f"CorpID mismatch: expected {self.receive_id}, got {from_receive_id}")
                
            return xml_content
        except Exception as e:
            raise ValueError(f"Failed to decrypt WeCom message: {e}")

    def decrypt_echo(self, encrypt_echo: str) -> str:
        """Decrypt URL verification token (echostr) on GET callback setup."""
        return self.decrypt(encrypt_echo)


def parse_xml_message(xml_str: str) -> dict:
    """Parse decrypted WeCom XML message into a flat dictionary."""
    root = ET.fromstring(xml_str)
    msg_data = {}
    for child in root:
        msg_data[child.tag] = child.text
    return msg_data

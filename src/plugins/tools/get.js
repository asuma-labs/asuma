import axios from 'axios';

const getPlugin = async (m, { conn: Ditss, usedPrefix, command, args }) => {
  if (!args.length) return m.reply(`📌 *Cara penggunaan:*\n${usedPrefix + command} <url>\n\nContoh:\n${usedPrefix + command} https://asuma.my.id`);

  const url = args[0];

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return m.reply('❌ URL harus diawali dengan http:// atau https://');
  }

  const detectLanguage = (url, contentType, data) => {
    const urlLower = url.toLowerCase();
    const strData = typeof data === 'string' ? data : JSON.stringify(data);
    
    if (urlLower.endsWith('.json') || contentType.includes('application/json') || contentType.includes('+json')) {
      return 'json';
    }
    if (urlLower.endsWith('.xml') || urlLower.endsWith('.rss') || urlLower.endsWith('.atom') || urlLower.endsWith('.sitemap') || contentType.includes('application/xml') || contentType.includes('text/xml') || contentType.includes('+xml') || (strData.trim().startsWith('<?xml') || strData.trim().startsWith('<'))) {
      return 'xml';
    }
    if (urlLower.endsWith('.html') || urlLower.endsWith('.htm') || contentType.includes('text/html') || strData.includes('<!DOCTYPE html') || strData.includes('<html')) {
      return 'html';
    }
    if (urlLower.endsWith('.css') || contentType.includes('text/css')) {
      return 'css';
    }
    if (urlLower.endsWith('.js') || urlLower.endsWith('.mjs') || contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
      return 'javascript';
    }
    if (urlLower.endsWith('.py') || (strData.includes('import ') && strData.includes('def ')) || (strData.includes('print(') && strData.includes(':'))) {
      return 'python';
    }
    if (urlLower.endsWith('.yaml') || urlLower.endsWith('.yml') || contentType.includes('application/yaml') || contentType.includes('text/yaml') || (strData.includes(': ') && strData.includes('\n') && !strData.includes('{') && !strData.includes('<!'))) {
      return 'yaml';
    }
    if (urlLower.endsWith('.md') || urlLower.endsWith('.markdown') || contentType.includes('text/markdown') || (strData.includes('# ') && strData.includes('\n') && !strData.includes('<'))) {
      return 'markdown';
    }
    if (urlLower.endsWith('.sh') || urlLower.endsWith('.bash') || contentType.includes('text/x-shellscript') || strData.startsWith('#!/bin/bash') || strData.startsWith('#!/bin/sh')) {
      return 'bash';
    }
    if (urlLower.endsWith('.sql') || contentType.includes('application/sql') || contentType.includes('text/sql') || (strData.toUpperCase().includes('SELECT ') && strData.toUpperCase().includes('FROM '))) {
      return 'sql';
    }
    if (urlLower.endsWith('.php') || contentType.includes('application/x-httpd-php') || contentType.includes('text/x-php') || strData.includes('<?php')) {
      return 'php';
    }
    if (urlLower.endsWith('.java') || contentType.includes('text/x-java-source') || strData.includes('public class ') || strData.includes('System.out.println')) {
      return 'java';
    }
    if (urlLower.endsWith('.cpp') || urlLower.endsWith('.cxx') || urlLower.endsWith('.cc') || urlLower.endsWith('.c++') || contentType.includes('text/x-c++src') || strData.includes('#include <iostream>') || strData.includes('std::cout')) {
      return 'cpp';
    }
    if (urlLower.endsWith('.c') || contentType.includes('text/x-csrc') || (strData.includes('#include <stdio.h>') && !strData.includes('iostream'))) {
      return 'c';
    }
    if (urlLower.endsWith('.cs') || contentType.includes('text/x-csharp') || strData.includes('using System;') || strData.includes('namespace ')) {
      return 'csharp';
    }
    if (urlLower.endsWith('.rs') || contentType.includes('text/x-rust') || strData.includes('fn main()') || strData.includes('println!')) {
      return 'rust';
    }
    if (urlLower.endsWith('.go') || contentType.includes('text/x-go') || strData.includes('package main') || strData.includes('func main()')) {
      return 'golang';
    }
    if (urlLower.endsWith('.rb') || contentType.includes('text/x-ruby') || strData.includes('def ') && strData.includes('end') && !strData.includes('<?php')) {
      return 'ruby';
    }
    if (urlLower.endsWith('.swift') || contentType.includes('text/x-swift') || strData.includes('import Foundation') || strData.includes('func ') && strData.includes('{')) {
      return 'swift';
    }
    if (urlLower.endsWith('.kt') || contentType.includes('text/x-kotlin') || strData.includes('fun main()') || strData.includes('println(')) {
      return 'kotlin';
    }
    if (urlLower.endsWith('.dart') || contentType.includes('text/x-dart') || strData.includes('void main()') || strData.includes('print(')) {
      return 'dart';
    }
    if (urlLower.endsWith('.lua') || contentType.includes('text/x-lua') || (strData.includes('function ') && strData.includes('end') && !strData.includes('def ') && !strData.includes('<?php'))) {
      return 'lua';
    }
    if (urlLower.endsWith('.r') || contentType.includes('text/x-r-source') || (strData.includes('<- ') && strData.includes('function('))) {
      return 'r';
    }
    if (urlLower.endsWith('.scala') || contentType.includes('text/x-scala') || strData.includes('def ') && strData.includes('val ') && strData.includes('=')) {
      return 'scala';
    }
    if (urlLower.endsWith('.erl') || contentType.includes('text/x-erlang') || strData.includes('-module(') || strData.includes('-export(')) {
      return 'erlang';
    }
    if (urlLower.endsWith('.ex') || urlLower.endsWith('.exs') || contentType.includes('text/x-elixir') || strData.includes('defmodule ') || strData.includes('defp ')) {
      return 'elixir';
    }
    if (urlLower.endsWith('.hs') || contentType.includes('text/x-haskell') || strData.includes('module ') && strData.includes('where') && strData.includes('::')) {
      return 'haskell';
    }
    if (urlLower.endsWith('.clj') || urlLower.endsWith('.cljs') || contentType.includes('text/x-clojure') || (strData.includes('(defn ') || strData.includes('(ns '))) {
      return 'clojure';
    }
    if (urlLower.endsWith('.groovy') || contentType.includes('text/x-groovy') || strData.includes('def ') && strData.includes('println') && !strData.includes('import ')) {
      return 'groovy';
    }
    if (urlLower.endsWith('.pl') || urlLower.endsWith('.pm') || contentType.includes('text/x-perl') || strData.includes('#!/usr/bin/perl') || strData.includes('use strict;')) {
      return 'perl';
    }
    if (urlLower.endsWith('.toml') || contentType.includes('application/toml') || (strData.includes('[') && strData.includes(']') && strData.includes('=') && !strData.includes('{') && !strData.includes('<'))) {
      return 'toml';
    }
    if (urlLower.endsWith('.proto') || contentType.includes('application/protobuf') || strData.includes('syntax = ') && strData.includes('message ')) {
      return 'protobuf';
    }
    if (urlLower.endsWith('.sol') || contentType.includes('text/x-solidity') || strData.includes('pragma solidity') || strData.includes('contract ')) {
      return 'solidity';
    }
    if (urlLower.endsWith('.tf') || urlLower.endsWith('.hcl') || contentType.includes('text/x-terraform') || (strData.includes('resource ') && strData.includes('{') && (strData.includes('provider ') || strData.includes('terraform {')))) {
      return 'terraform';
    }
    if (urlLower.endsWith('.graphql') || urlLower.endsWith('.gql') || contentType.includes('application/graphql') || (strData.includes('query ') || strData.includes('mutation ') || strData.includes('type ') && strData.includes('{') && !strData.includes('<!'))) {
      return 'graphql';
    }
    if (urlLower.endsWith('.dockerfile') || urlLower.includes('dockerfile') || contentType.includes('text/x-dockerfile') || (strData.includes('FROM ') && strData.includes('RUN ') && !strData.includes('<'))) {
      return 'dockerfile';
    }
    if (urlLower.endsWith('.makefile') || urlLower.includes('makefile') || contentType.includes('text/x-makefile') || (strData.includes('.PHONY:') || strData.includes('CC=') || strData.includes('CFLAGS='))) {
      return 'makefile';
    }
    if (urlLower.endsWith('.vim') || urlLower.endsWith('.vimrc') || contentType.includes('text/x-vim') || (strData.includes('" ') && strData.includes('set ') && strData.includes('=') && !strData.includes('<!'))) {
      return 'vim';
    }
    if (urlLower.endsWith('.ps1') || urlLower.endsWith('.psm1') || contentType.includes('text/x-powershell') || strData.includes('Write-Host ') || strData.includes('Get-ChildItem ')) {
      return 'powershell';
    }
    if (strData.startsWith('{') && strData.endsWith('}') && (strData.includes('"') || strData.includes(':'))) {
      return 'json';
    }
    if (strData.startsWith('<') && strData.endsWith('>') && !strData.includes('<!DOCTYPE html') && !strData.includes('<html')) {
      return 'xml';
    }
    
    return 'javascript';
  };

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000,
      maxContentLength: 10 * 1024 * 1024
    });

    const contentType = response.headers['content-type'] || '';
    const data = response.data;
    const language = detectLanguage(url, contentType, data);

    if (contentType.includes('application/json') || contentType.includes('+json') || language === 'json') {
      const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const truncated = jsonStr.length > 5000 ? jsonStr.substring(0, 5000) + '\n\n... (truncated)' : jsonStr;
      
      await Ditss.sendRichCodeMessage(m.chat, truncated, 'json', {
        header: `🌐 *GET Response*`,
        title: `📡 ${url}`,
        footer: `✅ Status: ${response.status} | Type: json`,
        quoted: m,
        mentions: [m.sender]
      });

    } else if (contentType.includes('text/html') || language === 'html') {
      const titleMatch = data.match(/<title>(.*?)<\/title>/i);
      const bodyText = data.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      const truncated = bodyText.length > 3000 ? bodyText.substring(0, 3000) + '\n\n... (truncated)' : bodyText;
      
      const title = titleMatch ? titleMatch[1] : 'HTML Response';
      
      await Ditss.sendRichCodeMessage(m.chat, truncated, 'html', {
        header: `🌐 *GET Response*`,
        title: `📄 ${title}`,
        footer: `✅ Status: ${response.status} | Type: html`,
        quoted: m,
        mentions: [m.sender]
      });

    } else {
      const strData = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const truncated = strData.length > 5000 ? strData.substring(0, 5000) + '\n\n... (truncated)' : strData;
      
      await Ditss.sendRichCodeMessage(m.chat, truncated, language, {
        header: `🌐 *GET Response*`,
        title: `📡 ${url}`,
        footer: `✅ Status: ${response.status} | Type: ${language}`,
        quoted: m,
        mentions: [m.sender]
      });
    }

  } catch (error) {
    console.error('Error GET Plugin:', error);

    if (error.code === 'ECONNABORTED') {
      return m.reply('❌ Request timeout. Server tidak merespon dalam 15 detik.');
    }
    if (error.response) {
      await m.error(error, {
        header: `❌ GAGAL GET (${error.response.status})`,
        footer: `URL: ${url}`,
        logToOwner: true,
        ownerJid: '628xxx@s.whatsapp.net'
      });
    } else {
      await m.error(error, {
        header: '❌ GAGAL GET',
        footer: `URL: ${url}`,
        logToOwner: true,
        ownerJid: '628xxx@s.whatsapp.net'
      });
    }
  }
};

getPlugin.help = ['<url> - GET request ke URL'];
getPlugin.tags = ['tools'];
getPlugin.command = ['get', 'fetch', 'curl'];
getPlugin.limit = true;

export default getPlugin;

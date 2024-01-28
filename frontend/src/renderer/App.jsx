import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import React, { useState, useMemo, useRef } from 'react';
import { FaSquare, FaCheckSquare, FaMinusSquare } from "react-icons/fa";
import { IoMdArrowDropright } from "react-icons/io";
import { AiOutlineLoading } from "react-icons/ai";
import TreeView from "react-accessible-treeview";

var rootFolder = {
  "name": "root",
  "fullpath": "/tmp",
  "type": "folder"
}

function toFileObj(file, path) {
  const fullpath = `${path}/${file.name}`;
  const f = parse(fullpath);
  return {
    name: file.name,
    fullpath: fullpath,
    type: file.isDirectory() ? 'folder' : 'file',
    filetype: !file.isDirectory() && f.ext ? f.ext.substring(1) : ''
  }
}

function fetchChildren(file) {
  return window.electronAPI.readdir(file.fullpath, {fullpath: true});
}

function constructOriginalFile(path) {
  const f = parse(path);
  return {
    fullpath: path,
    name: f.base,
    type: 'folder',
  }
}

function TreeView({ file, fetchChildren }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState(null);

  const onLineClicked = function () {
    if (file.type === 'folder') {
      if (!open && !files) {
        fetchChildren(file).then(childFiles => {
          console.log('set children done' + childFiles)
          setFiles(childFiles);
        })
      }
      setOpen(!open);
    }
  }

  return <div>
    <div className='' onClick={onLineClicked}>
      {file.name}
    </div>
    {open && files && <ul className='pl-4'>
      {files.map(f => <li key={f}>
        <TreeView file={f} fetchChildren={fetchChildren} />
      </li>)}
    </ul>}
  </div>
}

function Main() {
  return (
    <div className="min-h-screen prose">
      <div>
        <TreeView file={rootFolder} fetchChildren={fetchChildren} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Main />} />
      </Routes>
    </Router>
  );
}

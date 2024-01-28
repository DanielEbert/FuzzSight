import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { IoMdArrowDropright } from "react-icons/io";
import { IoMdArrowDropdown } from "react-icons/io";
import TreeView from "react-accessible-treeview";
import { Highlight, themes } from "prism-react-renderer"

// TODO: select root folder via other explorer selection
const initialData = [
  {
    name: "",
    id: 0,
    children: [1],
    parent: null,
    fullpath: ""
  },
  {
    name: "tmp",
    children: [],
    id: 1,
    parent: 0,
    isBranch: true,
    fullpath: "/tmp"
  }
];

function MultiSelectCheckboxAsync({ setSelectedFile }) {
  const loadedAlertElement = useRef(null);
  const [data, setData] = useState(initialData);
  const [nodesAlreadyLoaded, setNodesAlreadyLoaded] = useState([]);

  const updateTreeData = (list, id, children) => {
    const data = list.map((node) => {
      if (node.id === id) {
        node.children = children.map((el) => {
          return el.id;
        });
      }
      return node;
    });
    return data.concat(children);
  };

  const onLoadData = ({ element }) => {
    if (element.children.length > 0) {
      return Promise.resolve();
    }

    return window.electronAPI.readdir(element.fullpath, { fullpath: true, withFileTypes: true }).then(files => {
      console.log(files)
      const newChildren = files.map((file, i) => ({
        name: file.name,
        children: [],
        id: element.id + '-' + i,
        parent: element.id,
        isBranch: file.isFolder,
        fullpath: element.fullpath + '/' + file.name
      }));

      setData(value => updateTreeData(value, element.id, newChildren));
    });
  };

  const wrappedOnLoadData = async (props) => {
    const nodeHasNoChildData = props.element.children.length === 0;
    const nodeHasAlreadyBeenLoaded = nodesAlreadyLoaded.find(
      (e) => e.id === props.element.id
    );

    await onLoadData(props);

    if (nodeHasNoChildData && !nodeHasAlreadyBeenLoaded) {
      const el = loadedAlertElement.current;
      setNodesAlreadyLoaded([...nodesAlreadyLoaded, props.element]);
      el && (el.innerHTML = `${props.element.name} loaded`);

      // Clearing aria-live region so loaded node alerts no longer appear in DOM
      setTimeout(() => {
        el && (el.innerHTML = "");
      }, 5000);
    }
  };

  return (
    <>
      <div>
        <TreeView
          data={data}
          aria-label="Checkbox tree"
          onLoadData={wrappedOnLoadData}
          multiSelect
          propagateSelect
          togglableSelect
          propagateSelectUpwards
          nodeRenderer={({
            element,
            isBranch,
            isExpanded,
            isSelected,
            isHalfSelected,
            getNodeProps,
            level,
            handleSelect,
            handleExpand,
          }) => {
            return (
              <div
                {...getNodeProps({ onClick: handleExpand })}
                style={{ marginLeft: 40 * (level - 1) }}
                className='flex hover:bg-gray-300'
              >
                {
                  element.isBranch &&
                  <div className='flex-none flex items-center justify-center'>
                    {isExpanded ? <IoMdArrowDropdown /> : <IoMdArrowDropright />}
                  </div>
                }
                <div className='whitespace-nowrap select-none w-full' onClick={(e) => {
                  console.log('clicked' + element.fullpath)
                  if (element.isBranch) {
                    return;
                  }

                  setSelectedFile(element.fullpath);

                  e.stopPropagation();
                }}>{element.name}</div>
              </div>
            );
          }}
        />
      </div>
    </>
  );
}

function Sidebar({ setSelectedFile }) {
  const [width, setWidth] = useState(280);
  const isResized = useRef(false);

  useEffect(() => {
    window.addEventListener('mousemove', (e) => {
      if (!isResized.current) { return; }
      setWidth((prevWidth) => prevWidth + e.movementX);
    });
    window.addEventListener('mouseup', () => {
      isResized.current = false;
    })
  }, [])

  return (
    <div className='flex min-h-screen'>
      <div style={{ width: `${width / 16}rem` }} className='overflow-hidden'>
        <MultiSelectCheckboxAsync setSelectedFile={setSelectedFile} />
      </div>
      <div className='w-2 cursor-col-resize bg-gray-300' onMouseDown={() => isResized.current = true} />
    </div>
  )
}

function CodePanel({ selectedFile }) {
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!selectedFile) return;

    window.electronAPI.readFileSync(selectedFile).then(content => {
      console.log(content)
      // todo split by line?
      setCode(content)
    });

  }, [selectedFile])

  return <div className='pl-1'>
    <div className='text-xl tracking-tight text-gray-900 border-b mb-3 pl-1'>{selectedFile ? selectedFile : ''}</div>
    <Highlight theme={themes.oneDark} language='cpp' code={code}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre style={style} className='flex'>
          <div>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} className='bg-white text-right'>
                <div className='pr-2'>{i + 1}</div>
              </div>
            ))}
          </div>
          <div>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} className='flex bg-white'>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </div>
        </pre>
      )}
    </Highlight>
  </div>
}

function Main() {
  // TODO: change def sel file to null
  const [selectedFile, setSelectedFile] = useState('/tmp/a.cpp')

  return (
    <div className="min-h-screen w-full min-w-full prose flex">
      <Sidebar setSelectedFile={setSelectedFile} />
      <CodePanel selectedFile={selectedFile} />
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

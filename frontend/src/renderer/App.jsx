import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { IoMdArrowDropright } from "react-icons/io";
import { IoMdArrowDropdown } from "react-icons/io";
import { AiOutlineLoading } from "react-icons/ai";
import TreeView from "react-accessible-treeview";
import cx from "classnames";

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

function MultiSelectCheckboxAsync() {
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
                <div className='whitespace-nowrap select-none' onClick={(e) => {
                  console.log('clicked' + element.fullpath)
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

function Sidebar() {
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
        <MultiSelectCheckboxAsync />
      </div>
      <div className='w-2 cursor-col-resize bg-gray-300' onMouseDown={() => isResized.current = true} />
    </div>
  )
}

function Main() {
  return (
    <div className="min-h-screen w-full prose">
      <Sidebar />
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
